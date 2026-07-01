import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

const event = {
  slug: "ana-tomo-2024",
  name: "Vjencanje Ane i Tome",
  venue: "Dvorana Esplanade, Zagreb",
  date: new Date("2024-09-14T12:00:00"),
};

const guestGroups = [
  {
    name: "Maja Petrovic",
    maxPeople: 4,
    contact: "+385 91 234 5678",
    status: "confirmed",
    shareToken: "maja-petrovic-c79x4m",
    attendees: [
      { name: "Maja Petrovic", isChild: false },
      { name: "Ivan Petrovic", isChild: false },
      { name: "Luka Petrovic", isChild: true },
    ],
    note: "Luka je alergican na orasaste plodove",
  },
  {
    name: "Marko Horvat",
    maxPeople: 2,
    contact: "marko.horvat@gmail.com",
    status: "pending",
    shareToken: "marko-horvat-m3bt4k",
    attendees: [],
  },
  {
    name: "Ana i Tomislav Kovac",
    maxPeople: 2,
    contact: "+385 98 765 4321",
    status: "confirmed",
    shareToken: "ana-tomislav-kovac-r8c2px",
    attendees: [
      { name: "Ana Kovac", isChild: false },
      { name: "Tomislav Kovac", isChild: false },
    ],
  },
  {
    name: "Ivan Babic",
    maxPeople: 3,
    contact: "+385 91 111 2222",
    status: "declined",
    shareToken: "ivan-babic-n2dv7s",
    attendees: [],
    note: "Javili su da ne mogu doci",
  },
  {
    name: "Petra Simic",
    maxPeople: 2,
    contact: "petra.simic@gmail.com",
    status: "pending",
    shareToken: "petra-simic-x7kr5v",
    attendees: [],
  },
  {
    name: "Luka i Sara Novak",
    maxPeople: 4,
    contact: "+385 95 444 5555",
    status: "confirmed",
    shareToken: "luka-sara-novak-v6tw9e",
    attendees: [
      { name: "Luka Novak", isChild: false },
      { name: "Sara Novak", isChild: false },
      { name: "Ema Novak", isChild: true },
      { name: "Noa Novak", isChild: true },
    ],
    note: "Djeca trebaju visoku stolicu",
  },
  {
    name: "Kristina Blazevic",
    maxPeople: 1,
    contact: "+385 91 999 8888",
    status: "confirmed",
    shareToken: "kristina-blazevic-k4fp2q",
    attendees: [{ name: "Kristina Blazevic", isChild: false }],
  },
  {
    name: "Obitelj Juric",
    maxPeople: 5,
    contact: "+385 98 333 4444",
    status: "pending",
    shareToken: "obitelj-juric-q2ms5k",
    attendees: [],
  },
  {
    name: "Nikolina Grgic",
    maxPeople: 2,
    contact: "+385 91 777 6666",
    status: "confirmed",
    shareToken: "nikolina-grgic-j9rt2n",
    attendees: [
      { name: "Nikolina Grgic", isChild: false },
      { name: "Mateo Grgic", isChild: false },
    ],
  },
  {
    name: "Stjepan Vidovic",
    maxPeople: 1,
    contact: "stjepan.v@gmail.com",
    status: "pending",
    shareToken: "stjepan-vidovic-u3bc8y",
    attendees: [],
  },
];

const tables = [
  {
    name: "Stol 1",
    seats: 8,
    assignedPeople: [
      "Maja Petrovic",
      "Ivan Petrovic",
      "Luka Petrovic",
      "Ana Kovac",
      "Tomislav Kovac",
    ],
  },
  {
    name: "Stol 2",
    seats: 6,
    assignedPeople: [
      "Luka Novak",
      "Sara Novak",
      "Ema Novak",
      "Noa Novak",
      "Kristina Blazevic",
    ],
  },
  {
    name: "Stol 3",
    seats: 8,
    assignedPeople: [],
  },
];

function normalizeName(value) {
  return value.trim().toLowerCase();
}

async function main() {
  const existing = await prisma.event.count();

  if (existing > 0) {
    console.log("Seed skipped. Database already contains data.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const createdEvent = await tx.event.create({ data: event });
    const attendeeIdsByName = new Map();

    for (const guestGroup of guestGroups) {
      const createdGuestGroup = await tx.guestGroup.create({
        data: {
          eventId: createdEvent.id,
          name: guestGroup.name,
          maxPeople: guestGroup.maxPeople,
          contact: guestGroup.contact ?? null,
          status: guestGroup.status,
          shareToken: guestGroup.shareToken,
          note: guestGroup.note ?? null,
        },
      });

      for (const attendee of guestGroup.attendees) {
        const createdAttendee = await tx.attendee.create({
          data: {
            guestGroupId: createdGuestGroup.id,
            name: attendee.name,
            isChild: attendee.isChild,
          },
        });

        attendeeIdsByName.set(normalizeName(attendee.name), createdAttendee.id);
      }
    }

    for (const table of tables) {
      const createdTable = await tx.table.create({
        data: {
          eventId: createdEvent.id,
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

  console.log("Seed complete. Demo event created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
