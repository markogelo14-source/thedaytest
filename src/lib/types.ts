export type RSVPStatus = "confirmed" | "pending" | "declined";

export interface EventSummary {
  id: string;
  slug: string;
  name: string;
  venue: string;
  date: string;
  dateLabel: string;
  rsvpBasePath: string;
}

export interface GuestAttendeeDto {
  id: string;
  name: string;
  isChild: boolean;
  tableId: string | null;
  tableName: string | null;
}

export interface GuestGroupDto {
  id: string;
  name: string;
  maxPeople: number;
  contact: string | null;
  status: RSVPStatus;
  note: string | null;
  shareToken: string;
  createdAt: string;
  updatedAt: string;
  attendees: GuestAttendeeDto[];
  rsvpPath: string;
}

export interface TableAttendeeDto {
  id: string;
  name: string;
  isChild: boolean;
  guestGroupId: string;
  guestGroupName: string;
  tableId: string | null;
  tableName: string | null;
}

export interface TableDto {
  id: string;
  name: string;
  seats: number;
  createdAt: string;
  updatedAt: string;
  attendees: TableAttendeeDto[];
  occupancy: number;
  freeSeats: number;
  isFull: boolean;
}

export interface OrganizerStats {
  totalInvited: number;
  totalConfirmed: number;
  totalPendingSeats: number;
  totalDeclinedSeats: number;
  pendingGroupCount: number;
  declinedGroupCount: number;
  confirmedGroupCount: number;
  childrenCount: number;
  totalTables: number;
  totalSeats: number;
  seatedCount: number;
  unassignedCount: number;
}

export interface OrganizerSnapshot {
  event: EventSummary;
  guestGroups: GuestGroupDto[];
  recentConfirmed: GuestGroupDto[];
  tables: TableDto[];
  unassignedAttendees: TableAttendeeDto[];
  stats: OrganizerStats;
}

export interface PublicRsvpSnapshot {
  event: EventSummary;
  guestGroup: GuestGroupDto;
}

export interface EventLandingSnapshot {
  event: EventSummary;
}

export interface GuestGroupCreateInput {
  name: string;
  maxPeople: number;
  contact?: string | null;
}

export interface GuestGroupRsvpInput {
  status: RSVPStatus;
  note?: string | null;
  attendees: Array<{
    name: string;
    isChild: boolean;
  }>;
}

export interface TableCreateInput {
  name: string;
  seats: number;
}

export interface EventSettingsInput {
  name: string;
  venue: string;
  date: string;
}
