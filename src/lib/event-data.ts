import { RSVPStatus } from "@prisma/client";
import { format, parseISO } from "date-fns";
import { hr } from "date-fns/locale";

import { getPrisma } from "@/lib/prisma";
import {
  createShareToken,
  SEED_EVENT,
  SEED_GUEST_GROUPS,
  SEED_TABLES,
} from "@/lib/seed-data";
import type {
  EventLandingSnapshot,
  EventSettingsInput,
  GuestGroupCreateInput,
  GuestGroupDto,
  GuestGroupRsvpInput,
  OrganizerSnapshot,
  PublicRsvpSnapshot,
  RSVPStatus as FrontendRSVPStatus,
  TableAttendeeDto,
  TableCreateInput,
  TableDto,
} from "@/lib/types";

const eventInclude = {
  guestGroups: {
    orderBy: [{ createdAt: "asc" as const }],
    include: {
      attendees: {
        orderBy: [{ name: "asc" as const }],
      },
    },
  },
  tables: {
    orderBy: [{ createdAt: "asc" as const }],
    include: {
      attendees: {
        orderBy: [{ name: "asc" as const }],
        include: {
          guestGroup: true,
        },
      },
    },
  },
};

type EventRecord = Awaited<ReturnType<typeof getPrimaryEventRecord>>;

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function toEventDate(date: string) {
  return parseISO(`${date}T12:00:00`);
}

function toDateLabel(date: Date) {
  const formatted = format(date, "EEEE, d. MMMM yyyy.", { locale: hr });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function ensureStatus(status: FrontendRSVPStatus) {
  if (!["confirmed", "pending", "declined"].includes(status)) {
    throw new Error("Nepodrzan status.");
  }

  return status as RSVPStatus;
}

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function splitPipeList(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseImportedStatus(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized || normalized === "pending" || normalized === "ceka" || normalized === "čeka") {
    return "pending" as RSVPStatus;
  }

  if (normalized === "confirmed" || normalized === "dolazi") {
    return "confirmed" as RSVPStatus;
  }

  if (
    normalized === "declined" ||
    normalized === "ne dolazi" ||
    normalized === "nedolazi"
  ) {
    return "declined" as RSVPStatus;
  }

  throw new Error(`Nepoznat status u importu: ${value}`);
}

function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const next = csvText[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

export async function ensureSeededEvent() {
  const prisma = getPrisma();
  const existing = await prisma.event.count();

  if (existing > 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        slug: SEED_EVENT.slug,
        name: SEED_EVENT.name,
        venue: SEED_EVENT.venue,
        date: toEventDate(SEED_EVENT.date),
      },
    });

    const attendeeIdsByName = new Map<string, string>();

    for (const guest of SEED_GUEST_GROUPS) {
      const createdGuest = await tx.guestGroup.create({
        data: {
          eventId: event.id,
          name: guest.name,
          maxPeople: guest.maxPeople,
          contact: guest.contact ?? null,
          status: ensureStatus(guest.status),
          shareToken: guest.shareToken,
          note: guest.note ?? null,
        },
      });

      for (const attendee of guest.attendees) {
        const createdAttendee = await tx.attendee.create({
          data: {
            guestGroupId: createdGuest.id,
            name: attendee.name,
            isChild: attendee.isChild,
          },
        });

        attendeeIdsByName.set(normalizeName(attendee.name), createdAttendee.id);
      }
    }

    for (const table of SEED_TABLES) {
      const createdTable = await tx.table.create({
        data: {
          eventId: event.id,
          name: table.name,
          seats: table.seats,
        },
      });

      for (const attendeeName of table.assignedPeople) {
        const attendeeId = attendeeIdsByName.get(normalizeName(attendeeName));

        if (attendeeId) {
          await tx.attendee.update({
            where: { id: attendeeId },
            data: { tableId: createdTable.id },
          });
        }
      }
    }
  });
}

async function getPrimaryEventRecord() {
  const prisma = getPrisma();
  await ensureSeededEvent();

  const event = await prisma.event.findFirst({
    include: eventInclude,
  });

  if (!event) {
    throw new Error("Dogadaj nije pronaden.");
  }

  return event;
}

function toGuestGroupDto(event: EventRecord, tableNames: Map<string, string>) {
  return event.guestGroups.map<GuestGroupDto>((guestGroup) => ({
    id: guestGroup.id,
    name: guestGroup.name,
    maxPeople: guestGroup.maxPeople,
    contact: guestGroup.contact,
    status: guestGroup.status,
    note: guestGroup.note,
    shareToken: guestGroup.shareToken,
    createdAt: guestGroup.createdAt.toISOString(),
    updatedAt: guestGroup.updatedAt.toISOString(),
    attendees: guestGroup.attendees.map((attendee) => ({
      id: attendee.id,
      name: attendee.name,
      isChild: attendee.isChild,
      tableId: attendee.tableId,
      tableName: attendee.tableId ? tableNames.get(attendee.tableId) ?? null : null,
    })),
    rsvpPath: `/rsvp/${guestGroup.shareToken}`,
  }));
}

function toTableDtos(event: EventRecord): TableDto[] {
  return event.tables.map((table) => ({
    id: table.id,
    name: table.name,
    seats: table.seats,
    createdAt: table.createdAt.toISOString(),
    updatedAt: table.updatedAt.toISOString(),
    attendees: table.attendees.map((attendee) => ({
      id: attendee.id,
      name: attendee.name,
      isChild: attendee.isChild,
      guestGroupId: attendee.guestGroupId,
      guestGroupName: attendee.guestGroup.name,
      tableId: attendee.tableId,
      tableName: table.name,
    })),
    occupancy: table.attendees.length,
    freeSeats: Math.max(0, table.seats - table.attendees.length),
    isFull: table.attendees.length >= table.seats,
  }));
}

export async function getOrganizerSnapshot(): Promise<OrganizerSnapshot> {
  const event = await getPrimaryEventRecord();
  const tableNames = new Map(event.tables.map((table) => [table.id, table.name]));
  const guestGroups = toGuestGroupDto(event, tableNames);
  const tables = toTableDtos(event);

  const allAttendees = guestGroups.flatMap<TableAttendeeDto>((guestGroup) =>
    guestGroup.attendees.map((attendee) => ({
      id: attendee.id,
      name: attendee.name,
      isChild: attendee.isChild,
      guestGroupId: guestGroup.id,
      guestGroupName: guestGroup.name,
      tableId: attendee.tableId,
      tableName: attendee.tableName,
    })),
  );

  const totalInvited = guestGroups.reduce((sum, guestGroup) => sum + guestGroup.maxPeople, 0);
  const totalConfirmed = allAttendees.length;
  const totalPendingSeats = guestGroups
    .filter((guestGroup) => guestGroup.status === "pending")
    .reduce((sum, guestGroup) => sum + guestGroup.maxPeople, 0);
  const totalDeclinedSeats = guestGroups
    .filter((guestGroup) => guestGroup.status === "declined")
    .reduce((sum, guestGroup) => sum + guestGroup.maxPeople, 0);
  const pendingGroupCount = guestGroups.filter((guestGroup) => guestGroup.status === "pending").length;
  const declinedGroupCount = guestGroups.filter((guestGroup) => guestGroup.status === "declined").length;
  const confirmedGroupCount = guestGroups.filter((guestGroup) => guestGroup.status === "confirmed").length;
  const childrenCount = allAttendees.filter((attendee) => attendee.isChild).length;
  const totalSeats = tables.reduce((sum, table) => sum + table.seats, 0);
  const seatedCount = tables.reduce((sum, table) => sum + table.attendees.length, 0);
  const unassignedAttendees = allAttendees.filter((attendee) => !attendee.tableId);

  const recentConfirmed = [...guestGroups]
    .filter((guestGroup) => guestGroup.status === "confirmed")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 4);

  return {
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      venue: event.venue,
      date: toIsoDate(event.date),
      dateLabel: toDateLabel(event.date),
      rsvpBasePath: `/event/${event.slug}`,
    },
    guestGroups,
    recentConfirmed,
    tables,
    unassignedAttendees,
    stats: {
      totalInvited,
      totalConfirmed,
      totalPendingSeats,
      totalDeclinedSeats,
      pendingGroupCount,
      declinedGroupCount,
      confirmedGroupCount,
      childrenCount,
      totalTables: tables.length,
      totalSeats,
      seatedCount,
      unassignedCount: unassignedAttendees.length,
    },
  };
}

export async function getPublicRsvpSnapshot(token: string): Promise<PublicRsvpSnapshot | null> {
  const prisma = getPrisma();
  await ensureSeededEvent();

  const guestGroup = await prisma.guestGroup.findUnique({
    where: { shareToken: token },
    include: {
      event: true,
      attendees: {
        orderBy: [{ name: "asc" }],
      },
    },
  });

  if (!guestGroup) {
    return null;
  }

  return {
    event: {
      id: guestGroup.event.id,
      slug: guestGroup.event.slug,
      name: guestGroup.event.name,
      venue: guestGroup.event.venue,
      date: toIsoDate(guestGroup.event.date),
      dateLabel: toDateLabel(guestGroup.event.date),
      rsvpBasePath: `/event/${guestGroup.event.slug}`,
    },
    guestGroup: {
      id: guestGroup.id,
      name: guestGroup.name,
      maxPeople: guestGroup.maxPeople,
      contact: guestGroup.contact,
      status: guestGroup.status,
      note: guestGroup.note,
      shareToken: guestGroup.shareToken,
      createdAt: guestGroup.createdAt.toISOString(),
      updatedAt: guestGroup.updatedAt.toISOString(),
      attendees: guestGroup.attendees.map((attendee) => ({
        id: attendee.id,
        name: attendee.name,
        isChild: attendee.isChild,
        tableId: attendee.tableId,
        tableName: null,
      })),
      rsvpPath: `/rsvp/${guestGroup.shareToken}`,
    },
  };
}

export async function getEventLandingSnapshot(slug: string): Promise<EventLandingSnapshot | null> {
  const prisma = getPrisma();
  await ensureSeededEvent();

  const event = await prisma.event.findUnique({
    where: { slug },
  });

  if (!event) {
    return null;
  }

  return {
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      venue: event.venue,
      date: toIsoDate(event.date),
      dateLabel: toDateLabel(event.date),
      rsvpBasePath: `/event/${event.slug}`,
    },
  };
}

export async function createGuestGroup(input: GuestGroupCreateInput) {
  const prisma = getPrisma();
  const event = await getPrimaryEventRecord();
  const name = input.name.trim();
  const maxPeople = Number(input.maxPeople);
  const contact = input.contact?.trim();

  if (!name) {
    throw new Error("Ime gosta je obavezno.");
  }

  if (!Number.isInteger(maxPeople) || maxPeople < 1 || maxPeople > 20) {
    throw new Error("Broj osoba mora biti izmedu 1 i 20.");
  }

  await prisma.guestGroup.create({
    data: {
      eventId: event.id,
      name,
      maxPeople,
      contact: contact || null,
      shareToken: createShareToken(name),
      status: "pending",
      note: null,
    },
  });
}

export async function deleteGuestGroup(guestGroupId: string) {
  const prisma = getPrisma();
  await prisma.guestGroup.delete({
    where: { id: guestGroupId },
  });
}

export async function updateGuestGroupRsvp(guestGroupId: string, input: GuestGroupRsvpInput) {
  const prisma = getPrisma();
  const guestGroup = await prisma.guestGroup.findUnique({
    where: { id: guestGroupId },
    include: {
      attendees: true,
    },
  });

  if (!guestGroup) {
    throw new Error("Gost nije pronaden.");
  }

  const status = ensureStatus(input.status);
  const note = input.note?.trim() || null;
  const cleanedAttendees = input.attendees
    .map((attendee) => ({
      name: attendee.name.trim(),
      isChild: attendee.isChild,
    }))
    .filter((attendee) => attendee.name);

  if (status === "confirmed") {
    if (cleanedAttendees.length === 0) {
      throw new Error("Potrebno je unijeti barem jednu osobu.");
    }

    if (cleanedAttendees.length > guestGroup.maxPeople) {
      throw new Error("Potvrdeno je previse osoba za ovu pozivnicu.");
    }
  }

  const previousTableByName = new Map(
    guestGroup.attendees.map((attendee) => [normalizeName(attendee.name), attendee.tableId]),
  );

  await prisma.$transaction(async (tx) => {
    await tx.attendee.deleteMany({
      where: { guestGroupId },
    });

    await tx.guestGroup.update({
      where: { id: guestGroupId },
      data: {
        status,
        note,
      },
    });

    if (status === "confirmed") {
      for (const attendee of cleanedAttendees) {
        await tx.attendee.create({
          data: {
            guestGroupId,
            name: attendee.name,
            isChild: attendee.isChild,
            tableId: previousTableByName.get(normalizeName(attendee.name)) ?? null,
          },
        });
      }
    }
  });
}

export async function createTable(input: TableCreateInput) {
  const prisma = getPrisma();
  const event = await getPrimaryEventRecord();
  const name = input.name.trim();
  const seats = Number(input.seats);

  if (!name) {
    throw new Error("Naziv stola je obavezan.");
  }

  if (!Number.isInteger(seats) || seats < 1 || seats > 50) {
    throw new Error("Broj mjesta mora biti izmedu 1 i 50.");
  }

  await prisma.table.create({
    data: {
      eventId: event.id,
      name,
      seats,
    },
  });
}

export async function deleteTable(tableId: string) {
  const prisma = getPrisma();
  await prisma.table.delete({
    where: { id: tableId },
  });
}

export async function assignAttendeesToTable(tableId: string, attendeeIds: string[]) {
  const prisma = getPrisma();
  const ids = [...new Set(attendeeIds)];
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      attendees: true,
    },
  });

  if (!table) {
    throw new Error("Stol nije pronaden.");
  }

  if (ids.length === 0) {
    throw new Error("Nema odabranih osoba.");
  }

  const attendees = await prisma.attendee.findMany({
    where: {
      id: { in: ids },
    },
    include: {
      guestGroup: true,
    },
  });

  if (attendees.length !== ids.length) {
    throw new Error("Neke osobe vise ne postoje.");
  }

  if (attendees.some((attendee) => attendee.guestGroup.eventId !== table.eventId)) {
    throw new Error("Odabrane osobe ne pripadaju ovom dogadaju.");
  }

  if (attendees.some((attendee) => attendee.tableId && attendee.tableId !== tableId)) {
    throw new Error("Neke osobe su vec rasporedene za drugi stol.");
  }

  const freeSeats = table.seats - table.attendees.length;

  if (ids.length > freeSeats) {
    throw new Error("Na ovom stolu nema dovoljno slobodnih mjesta.");
  }

  await prisma.attendee.updateMany({
    where: {
      id: { in: ids },
    },
    data: {
      tableId,
    },
  });
}

export async function removeAttendeeFromTable(tableId: string, attendeeId: string) {
  const prisma = getPrisma();
  const attendee = await prisma.attendee.findUnique({
    where: { id: attendeeId },
  });

  if (!attendee || attendee.tableId !== tableId) {
    throw new Error("Osoba nije pronadena na ovom stolu.");
  }

  await prisma.attendee.update({
    where: { id: attendeeId },
    data: {
      tableId: null,
    },
  });
}

export async function updateEventSettings(input: EventSettingsInput) {
  const prisma = getPrisma();
  const event = await getPrimaryEventRecord();
  const name = input.name.trim();
  const venue = input.venue.trim();
  const date = input.date.trim();

  if (!name || !venue || !date) {
    throw new Error("Naziv, datum i lokacija su obavezni.");
  }

  await prisma.event.update({
    where: { id: event.id },
    data: {
      name,
      venue,
      date: toEventDate(date),
    },
  });
}

export async function exportGuestGroupsToCsv() {
  const event = await getPrimaryEventRecord();
  const tableNames = new Map(event.tables.map((table) => [table.id, table.name]));
  const guestGroups = toGuestGroupDto(event, tableNames);

  const header = [
    "name",
    "maxPeople",
    "contact",
    "status",
    "note",
    "attendees",
    "children",
  ];

  const lines = guestGroups.map((guestGroup) => {
    const attendees = guestGroup.attendees.map((attendee) => attendee.name).join(" | ");
    const children = guestGroup.attendees
      .filter((attendee) => attendee.isChild)
      .map((attendee) => attendee.name)
      .join(" | ");

    return [
      guestGroup.name,
      String(guestGroup.maxPeople),
      guestGroup.contact ?? "",
      guestGroup.status,
      guestGroup.note ?? "",
      attendees,
      children,
    ]
      .map(escapeCsvValue)
      .join(",");
  });

  return [header.join(","), ...lines].join("\n");
}

export async function importGuestGroupsFromCsv(
  csvText: string,
  mode: "append" | "replace",
) {
  const prisma = getPrisma();
  const event = await getPrimaryEventRecord();
  const rows = parseCsvRows(csvText.trim());

  if (rows.length < 2) {
    throw new Error("CSV mora sadrzavati zaglavlje i barem jedan red.");
  }

  const [headerRow, ...dataRows] = rows;
  const headerMap = new Map(
    headerRow.map((header, index) => [header.trim().toLowerCase(), index]),
  );

  const nameIndex = headerMap.get("name");
  const maxPeopleIndex = headerMap.get("maxpeople");

  if (nameIndex === undefined || maxPeopleIndex === undefined) {
    throw new Error("CSV mora sadrzavati stupce 'name' i 'maxPeople'.");
  }

  const contactIndex = headerMap.get("contact");
  const statusIndex = headerMap.get("status");
  const noteIndex = headerMap.get("note");
  const attendeesIndex = headerMap.get("attendees");
  const childrenIndex = headerMap.get("children");

  const records = dataRows.map((row, index) => {
    const name = row[nameIndex]?.trim() ?? "";
    const maxPeople = Number(row[maxPeopleIndex] ?? "");
    const contact = contactIndex !== undefined ? row[contactIndex]?.trim() ?? "" : "";
    const note = noteIndex !== undefined ? row[noteIndex]?.trim() ?? "" : "";
    const attendees = attendeesIndex !== undefined ? splitPipeList(row[attendeesIndex] ?? "") : [];
    const children = new Set(
      childrenIndex !== undefined ? splitPipeList(row[childrenIndex] ?? "") : [],
    );
    const status = parseImportedStatus(
      statusIndex !== undefined ? row[statusIndex] ?? "" : "pending",
    );

    if (!name) {
      throw new Error(`Red ${index + 2}: ime gosta je obavezno.`);
    }

    if (!Number.isInteger(maxPeople) || maxPeople < 1 || maxPeople > 20) {
      throw new Error(`Red ${index + 2}: maxPeople mora biti cijeli broj izmedu 1 i 20.`);
    }

    if (attendees.length > maxPeople) {
      throw new Error(`Red ${index + 2}: vise potvrdenih osoba nego sto pozivnica dopusta.`);
    }

    if (status === "confirmed" && attendees.length === 0) {
      throw new Error(`Red ${index + 2}: potvrdjeni gost mora imati barem jednu osobu.`);
    }

    return {
      name,
      maxPeople,
      contact: contact || null,
      note: note || null,
      status,
      shareToken: createShareToken(name),
      attendees: attendees.map((attendeeName) => ({
        name: attendeeName,
        isChild: children.has(attendeeName),
      })),
    };
  });

  await prisma.$transaction(async (tx) => {
    if (mode === "replace") {
      await tx.guestGroup.deleteMany({
        where: { eventId: event.id },
      });
    }

    for (const record of records) {
      const guestGroup = await tx.guestGroup.create({
        data: {
          eventId: event.id,
          name: record.name,
          maxPeople: record.maxPeople,
          contact: record.contact,
          status: record.status,
          shareToken: record.shareToken,
          note: record.note,
        },
      });

      for (const attendee of record.attendees) {
        await tx.attendee.create({
          data: {
            guestGroupId: guestGroup.id,
            name: attendee.name,
            isChild: attendee.isChild,
          },
        });
      }
    }
  });

  return {
    importedCount: records.length,
  };
}

export async function submitPublicRsvp(token: string, input: GuestGroupRsvpInput) {
  const prisma = getPrisma();
  const guestGroup = await prisma.guestGroup.findUnique({
    where: { shareToken: token },
  });

  if (!guestGroup) {
    throw new Error("Pozivnica nije pronadena.");
  }

  await updateGuestGroupRsvp(guestGroup.id, input);
}
