"use client";

import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Baby,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Home,
  LayoutGrid,
  LogOut,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  Users,
  XCircle,
} from "lucide-react";

import { getErrorMessage } from "@/lib/errors";
import type {
  EventSettingsInput,
  GuestGroupDto,
  GuestGroupRsvpInput,
  OrganizerSnapshot,
  RSVPStatus,
  TableAttendeeDto,
  TableDto,
} from "@/lib/types";

type Tab = "home" | "guests" | "tables" | "settings";
type GuestsView = "list" | "detail" | "add" | "edit";
type TablesView = "list" | "detail" | "addTable" | "addPeople";
type StatusFilter = "all" | RSVPStatus;
type ImportMode = "append" | "replace";

const STATUS_META: Record<
  RSVPStatus,
  {
    label: string;
    dot: string;
    text: string;
    pill: string;
  }
> = {
  confirmed: {
    label: "Dolazi",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    pill: "bg-emerald-100 text-emerald-700",
  },
  pending: {
    label: "Čeka odgovor",
    dot: "bg-amber-400",
    text: "text-amber-700",
    pill: "bg-amber-100 text-amber-700",
  },
  declined: {
    label: "Ne dolazi",
    dot: "bg-rose-400",
    text: "text-rose-700",
    pill: "bg-rose-100 text-rose-700",
  },
};

interface OrganizerAppProps {
  initialData: OrganizerSnapshot;
}

export function OrganizerApp({ initialData }: OrganizerAppProps) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [guestsView, setGuestsView] = useState<GuestsView>("list");
  const [tablesView, setTablesView] = useState<TablesView>("list");
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const selectedGuest =
    data.guestGroups.find((guestGroup) => guestGroup.id === selectedGuestId) ?? null;
  const selectedTable =
    data.tables.find((table) => table.id === selectedTableId) ?? null;
  const isBusy = isPending || isDownloading || isImporting || isSigningOut;

  function showFeedback(nextMessage: string) {
    setMessage(nextMessage);
    setTimeout(() => setMessage(null), 2500);
  }

  function redirectToSignIn() {
    if (typeof window !== "undefined") {
      window.location.href = "/sign-in";
    }
  }

  async function getResponseError(response: Response, fallbackMessage: string) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const result = (await response.json()) as { error?: string };
      return result.error ?? fallbackMessage;
    }

    const text = await response.text();
    return text || fallbackMessage;
  }

  async function requestSnapshot(
    input: RequestInfo,
    init: RequestInit,
    successMessage: string,
  ) {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(input, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
          },
        });

        if (response.status === 401) {
          redirectToSignIn();
          return;
        }

        const result = (await response.json()) as OrganizerSnapshot & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result.error ?? "Spremanje nije uspjelo.");
        }

        setData(result);
        showFeedback(successMessage);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      }
    });
  }

  function copyPath(path: string, copiedMessage: string) {
    const url =
      typeof window === "undefined" ? path : `${window.location.origin}${path}`;

    navigator.clipboard.writeText(url).then(
      () => showFeedback(copiedMessage),
      () => setError("Kopiranje linka nije uspjelo."),
    );
  }

  function getDownloadFilename(headerValue: string | null, fallbackFilename: string) {
    if (!headerValue) {
      return fallbackFilename;
    }

    const match = headerValue.match(/filename="?([^"]+)"?/i);
    return match?.[1] ?? fallbackFilename;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }

  async function downloadFile(
    path: string,
    fallbackFilename: string,
    successMessage: string,
  ) {
    setError(null);
    setIsDownloading(true);

    try {
      const response = await fetch(path, { method: "GET" });

      if (response.status === 401) {
        redirectToSignIn();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "Preuzimanje nije uspjelo."),
        );
      }

      const blob = await response.blob();
      const filename = getDownloadFilename(
        response.headers.get("content-disposition"),
        fallbackFilename,
      );

      downloadBlob(blob, filename);
      showFeedback(successMessage);
    } catch (downloadError) {
      setError(getErrorMessage(downloadError));
    } finally {
      setIsDownloading(false);
    }
  }

  async function importGuests(file: File, mode: ImportMode) {
    setError(null);
    setIsImporting(true);

    try {
      const csvText = await file.text();
      const response = await fetch("/api/import-export/guests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csvText, mode }),
      });

      if (response.status === 401) {
        redirectToSignIn();
        return;
      }

      const result = (await response.json()) as OrganizerSnapshot & {
        error?: string;
        importSummary?: {
          importedCount?: number;
        };
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Uvoz nije uspio.");
      }

      const { importSummary, ...snapshot } = result;
      setData(snapshot);
      setActiveTab("guests");
      setGuestsView("list");
      setSelectedGuestId(null);
      showFeedback(
        importSummary?.importedCount
          ? `Uvezeno ${importSummary.importedCount} pozivnica.`
          : "CSV je uspješno uvezen.",
      );
    } catch (importError) {
      setError(getErrorMessage(importError));
    } finally {
      setIsImporting(false);
    }
  }

  async function signOut() {
    setError(null);
    setIsSigningOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Odjava nije uspjela."));
      }

      redirectToSignIn();
    } catch (signOutError) {
      setError(getErrorMessage(signOutError));
      setIsSigningOut(false);
    }
  }

  const navItems = [
    { id: "home" as const, label: "Početna", icon: Home },
    { id: "guests" as const, label: "Gosti", icon: Users },
    { id: "tables" as const, label: "Stolovi", icon: LayoutGrid },
    { id: "settings" as const, label: "Postavke", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(201,149,106,0.14),transparent_30%),linear-gradient(180deg,#fbf8f5_0%,#f6f1eb_100%)]">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-white/70 bg-[rgba(255,255,255,0.82)] px-5 py-6 shadow-[24px_0_64px_rgba(28,25,23,0.06)] backdrop-blur md:flex">
        <div className="rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,245,0.96))] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Događaj
          </p>
          <h1 className="mt-3 font-display text-4xl text-[color:var(--foreground)]">
            {data.event.name}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[color:var(--muted-foreground)]">
            {data.event.dateLabel} · {data.event.venue}
          </p>
        </div>

        <nav className="mt-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                  active
                    ? "bg-[color:var(--foreground)] text-[color:var(--background)] shadow-[0_18px_38px_rgba(28,25,23,0.14)]"
                    : "text-[color:var(--muted-foreground)] hover:bg-white/70 hover:text-[color:var(--foreground)]"
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_14px_32px_rgba(28,25,23,0.06)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Pregled
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <StatRow label="Dolazi" value={String(data.stats.totalConfirmed)} accent="text-emerald-600" />
            <StatRow label="Čeka odgovor" value={String(data.stats.pendingGroupCount)} accent="text-amber-600" />
            <StatRow label="Ne dolazi" value={String(data.stats.declinedGroupCount)} accent="text-rose-600" />
            <div className="h-px bg-[color:var(--border)]" />
            <StatRow label="Pozvano" value={String(data.stats.totalInvited)} />
          </div>
        </div>

        <button
          type="button"
          disabled={isSigningOut}
          onClick={signOut}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--border)] bg-white/85 px-4 py-3 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut size={16} />
          {isSigningOut ? "Odjavljujem..." : "Odjava"}
        </button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <div className="sticky top-0 z-20 border-b border-white/60 bg-[rgba(251,248,245,0.82)] px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
                Organizer
              </p>
              <p className="mt-1 font-display text-2xl text-[color:var(--foreground)]">
                {data.event.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-white/90 px-3 py-2 text-sm text-[color:var(--foreground)] shadow-[0_10px_20px_rgba(28,25,23,0.08)]">
                {data.stats.totalConfirmed} dolazi
              </div>
              <button
                type="button"
                disabled={isSigningOut}
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-2 text-sm text-[color:var(--foreground)] shadow-[0_10px_20px_rgba(28,25,23,0.08)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut size={14} />
                Odjava
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1">
          <div className="px-4 py-5 sm:px-6 lg:px-8">
            {message && (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {activeTab === "home" && (
              <HomeView
                data={data}
                onOpenGuests={() => {
                  setActiveTab("guests");
                  setGuestsView("list");
                }}
              />
            )}

            {activeTab === "guests" && (
              <GuestsViewPanel
                guestGroups={data.guestGroups}
                selectedGuest={selectedGuest}
                view={guestsView}
                isPending={isPending}
                onSelectGuest={(guestId) => {
                  setSelectedGuestId(guestId);
                  setGuestsView("detail");
                }}
                onBackToList={() => {
                  setGuestsView("list");
                  setSelectedGuestId(null);
                }}
                onShowAddGuest={() => {
                  setGuestsView("add");
                  setSelectedGuestId(null);
                }}
                onShowEditGuest={() => setGuestsView("edit")}
                onCreateGuest={(payload) =>
                  requestSnapshot(
                    "/api/guest-groups",
                    {
                      method: "POST",
                      body: JSON.stringify(payload),
                    },
                    "Gost je dodan.",
                  )
                }
                onDeleteGuest={(guestGroupId) =>
                  requestSnapshot(
                    `/api/guest-groups/${guestGroupId}`,
                    { method: "DELETE", body: JSON.stringify({}) },
                    "Gost je uklonjen.",
                  )
                }
                onSaveRsvp={(guestGroupId, payload) =>
                  requestSnapshot(
                    `/api/guest-groups/${guestGroupId}`,
                    {
                      method: "PATCH",
                      body: JSON.stringify(payload),
                    },
                    "Odgovor gosta je spremljen.",
                  )
                }
                onCopyLink={(guestGroup) =>
                  copyPath(guestGroup.rsvpPath, "Personalizirani link je kopiran.")
                }
              />
            )}

            {activeTab === "tables" && (
              <TablesViewPanel
                tables={data.tables}
                unassignedAttendees={data.unassignedAttendees}
                selectedTable={selectedTable}
                view={tablesView}
                isPending={isPending}
                onSelectTable={(tableId) => {
                  setSelectedTableId(tableId);
                  setTablesView("detail");
                }}
                onBackToList={() => {
                  setTablesView("list");
                  setSelectedTableId(null);
                }}
                onShowAddTable={() => {
                  setTablesView("addTable");
                  setSelectedTableId(null);
                }}
                onShowAddPeople={() => setTablesView("addPeople")}
                onCreateTable={(payload) =>
                  requestSnapshot(
                    "/api/tables",
                    {
                      method: "POST",
                      body: JSON.stringify(payload),
                    },
                    "Stol je dodan.",
                  )
                }
                onDeleteTable={(tableId) =>
                  requestSnapshot(
                    `/api/tables/${tableId}`,
                    { method: "DELETE", body: JSON.stringify({}) },
                    "Stol je uklonjen.",
                  )
                }
                onAssignAttendees={(tableId, attendeeIds) =>
                  requestSnapshot(
                    `/api/tables/${tableId}`,
                    {
                      method: "PATCH",
                      body: JSON.stringify({
                        action: "assignAttendees",
                        attendeeIds,
                      }),
                    },
                    "Osobe su dodane za stol.",
                  )
                }
                onRemoveAttendee={(tableId, attendeeId) =>
                  requestSnapshot(
                    `/api/tables/${tableId}`,
                    {
                      method: "PATCH",
                      body: JSON.stringify({
                        action: "removeAttendee",
                        attendeeId,
                      }),
                    },
                    "Osoba je uklonjena sa stola.",
                  )
                }
              />
            )}

            {activeTab === "settings" && (
              <SettingsViewPanel
                key={`${data.event.name}-${data.event.date}-${data.event.venue}`}
                event={data.event}
                isPending={isBusy}
                onSave={(payload) =>
                  requestSnapshot(
                    "/api/event",
                    {
                      method: "PUT",
                      body: JSON.stringify(payload),
                    },
                    "Postavke događaja su spremljene.",
                  )
                }
                onCopyBaseLink={() =>
                  copyPath(data.event.rsvpBasePath, "Javni link događaja je kopiran.")
                }
                onExportGuests={() =>
                  downloadFile(
                    "/api/import-export/guests",
                    "theday-guests.csv",
                    "CSV gostiju je preuzet.",
                  )
                }
                onExportBackup={() =>
                  downloadFile(
                    "/api/import-export/backup",
                    "theday-backup.json",
                    "Backup podataka je preuzet.",
                  )
                }
                onImportGuests={importGuests}
              />
            )}
          </div>
        </main>

        <nav className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-white/60 bg-[rgba(255,255,255,0.9)] backdrop-blur md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 text-xs transition ${
                  active ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"
                }`}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[color:var(--muted-foreground)]">{label}</span>
      <span className={`font-semibold text-[color:var(--foreground)] ${accent ?? ""}`}>
        {value}
      </span>
    </div>
  );
}

function HomeView({
  data,
  onOpenGuests,
}: {
  data: OrganizerSnapshot;
  onOpenGuests: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_rgba(28,25,23,0.08)] sm:p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
          {data.event.dateLabel} · {data.event.venue}
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] bg-[color:var(--foreground)] p-6 text-[color:var(--background)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] opacity-60">Ukupno dolazi</p>
                <p className="mt-4 font-display text-7xl leading-none sm:text-8xl">
                  {data.stats.totalConfirmed}
                </p>
                <p className="mt-4 text-sm opacity-70">
                  {data.stats.childrenCount > 0
                    ? `${data.stats.childrenCount} djece · ${data.stats.totalConfirmed - data.stats.childrenCount} odraslih`
                    : "Potvrđenih gostiju"}
                </p>
              </div>
              <CheckCircle2 size={22} className="opacity-40" />
            </div>
            <div className="mt-8 flex flex-wrap gap-3 text-sm opacity-75">
              <span>{data.stats.totalInvited} ukupno pozvano</span>
              <span>·</span>
              <span>{data.stats.confirmedGroupCount} potvrđenih pozivnica</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <MetricCard
              title="Čeka odgovor"
              value={String(data.stats.totalPendingSeats)}
              caption={`${data.stats.pendingGroupCount} pozivnica`}
              icon={<Clock3 size={18} className="text-amber-500" />}
            />
            <MetricCard
              title="Ne dolazi"
              value={String(data.stats.totalDeclinedSeats)}
              caption={`${data.stats.declinedGroupCount} pozivnica`}
              icon={<XCircle size={18} className="text-rose-500" />}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_20px_64px_rgba(28,25,23,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
                Nedavno potvrđeni
              </p>
              <h2 className="mt-3 font-display text-4xl text-[color:var(--foreground)]">
                Gosti
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenGuests}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-2 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
            >
              Svi gosti
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {data.recentConfirmed.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--muted-foreground)]">
                Još nema potvrđenih gostiju.
              </div>
            ) : (
              data.recentConfirmed.map((guestGroup) => (
                <div
                  key={guestGroup.id}
                  className="flex items-center gap-4 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg text-[color:var(--foreground)] shadow-[0_10px_18px_rgba(28,25,23,0.06)]">
                    {guestGroup.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base text-[color:var(--foreground)]">
                      {guestGroup.name}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                      {guestGroup.attendees.length} / {guestGroup.maxPeople} osobe
                    </p>
                  </div>
                  {guestGroup.attendees.some((attendee) => attendee.isChild) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
                      <Baby size={12} />
                      {
                        guestGroup.attendees.filter((attendee) => attendee.isChild)
                          .length
                      }{" "}
                      djece
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-5">
          <button
            type="button"
            onClick={onOpenGuests}
            className="w-full rounded-[32px] bg-[linear-gradient(135deg,#c9956a,#a86f43)] p-6 text-left text-white shadow-[0_24px_54px_rgba(168,111,67,0.28)] transition hover:translate-y-[-1px]"
          >
            <Plus size={20} />
            <p className="mt-5 text-xl">Dodaj goste</p>
            <p className="mt-2 text-sm opacity-80">
              Upravljajte pozivnicama i pratite odgovore na jednom mjestu.
            </p>
          </button>

          <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_20px_64px_rgba(28,25,23,0.06)]">
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
              Raspored sjedenja
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MetricCard
                title="Popunjena mjesta"
                value={String(data.stats.seatedCount)}
                caption={`${data.stats.totalSeats} ukupno mjesta`}
                icon={<LayoutGrid size={18} className="text-[color:var(--accent)]" />}
              />
              <MetricCard
                title="Neraspoređeni"
                value={String(data.stats.unassignedCount)}
                caption="Potvrđene osobe bez stola"
                icon={<Users size={18} className="text-[color:var(--foreground)]" />}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  caption,
  icon,
}: {
  title: string;
  value: string;
  caption: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_14px_36px_rgba(28,25,23,0.05)]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[color:var(--muted-foreground)]">{title}</p>
        {icon}
      </div>
      <p className="mt-4 font-display text-5xl leading-none text-[color:var(--foreground)]">
        {value}
      </p>
      <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">{caption}</p>
    </div>
  );
}

function GuestsViewPanel({
  guestGroups,
  selectedGuest,
  view,
  isPending,
  onSelectGuest,
  onBackToList,
  onShowAddGuest,
  onShowEditGuest,
  onCreateGuest,
  onDeleteGuest,
  onSaveRsvp,
  onCopyLink,
}: {
  guestGroups: GuestGroupDto[];
  selectedGuest: GuestGroupDto | null;
  view: GuestsView;
  isPending: boolean;
  onSelectGuest: (guestId: string) => void;
  onBackToList: () => void;
  onShowAddGuest: () => void;
  onShowEditGuest: () => void;
  onCreateGuest: (payload: { name: string; maxPeople: number; contact?: string }) => void;
  onDeleteGuest: (guestId: string) => void;
  onSaveRsvp: (guestId: string, payload: GuestGroupRsvpInput) => void;
  onCopyLink: (guestGroup: GuestGroupDto) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const deferredSearch = useDeferredValue(search);

  const filteredGuests = useMemo(() => {
    return guestGroups.filter((guestGroup) => {
      if (filter !== "all" && guestGroup.status !== filter) {
        return false;
      }

      if (!deferredSearch.trim()) {
        return true;
      }

      return guestGroup.name
        .toLowerCase()
        .includes(deferredSearch.trim().toLowerCase());
    });
  }, [deferredSearch, filter, guestGroups]);

  const counts = {
    all: guestGroups.length,
    confirmed: guestGroups.filter((guestGroup) => guestGroup.status === "confirmed").length,
    pending: guestGroups.filter((guestGroup) => guestGroup.status === "pending").length,
    declined: guestGroups.filter((guestGroup) => guestGroup.status === "declined").length,
  };

  const mobileShowList = view === "list";

  return (
    <div className="flex min-h-[calc(100vh-11rem)] overflow-hidden rounded-[36px] border border-white/70 bg-white/90 shadow-[0_24px_70px_rgba(28,25,23,0.08)]">
      <div
        className={`${
          mobileShowList ? "flex" : "hidden md:flex"
        } w-full shrink-0 flex-col border-r border-[color:var(--border)] md:w-[24rem]`}
      >
        <div className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-white/95 px-5 py-5 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
                Upravljanje
              </p>
              <h2 className="mt-2 font-display text-4xl text-[color:var(--foreground)]">
                Gosti
              </h2>
            </div>
            <button
              type="button"
              onClick={onShowAddGuest}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--foreground)] px-4 py-2 text-sm text-[color:var(--background)] transition hover:opacity-90"
            >
              <Plus size={16} />
              Dodaj
            </button>
          </div>

          <div className="relative mt-5">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-full border border-[color:var(--border)] bg-[color:var(--panel)] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[color:var(--accent)]"
              placeholder="Pretraži goste..."
            />
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {(["all", "confirmed", "pending", "declined"] as StatusFilter[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs uppercase tracking-[0.16em] transition ${
                  filter === status
                    ? "border-transparent bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "border-[color:var(--border)] bg-white text-[color:var(--muted-foreground)]"
                }`}
              >
                {status === "all"
                  ? "Svi"
                  : status === "confirmed"
                    ? "Dolazi"
                    : status === "pending"
                      ? "Čeka"
                      : "Ne dolazi"}{" "}
                ({counts[status]})
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {filteredGuests.length === 0 ? (
            <EmptyState icon={<Users size={28} />} title="Nema gostiju za prikaz." />
          ) : (
            filteredGuests.map((guestGroup) => {
              const active = selectedGuest?.id === guestGroup.id;
              const childCount = guestGroup.attendees.filter((attendee) => attendee.isChild).length;
              const status = STATUS_META[guestGroup.status];

              return (
                <button
                  key={guestGroup.id}
                  type="button"
                  onClick={() => onSelectGuest(guestGroup.id)}
                  className={`w-full rounded-[26px] border px-4 py-4 text-left transition ${
                    active
                      ? "border-[color:var(--accent)] bg-[rgba(201,149,106,0.12)]"
                      : "border-[color:var(--border)] bg-[color:var(--panel)] hover:border-[color:var(--accent)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-base text-[color:var(--foreground)] shadow-[0_10px_18px_rgba(28,25,23,0.05)]">
                      {guestGroup.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base text-[color:var(--foreground)]">
                        {guestGroup.name}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${status.pill}`}>
                          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                        <span className="text-[color:var(--muted-foreground)]">
                          {guestGroup.attendees.length} / {guestGroup.maxPeople} osobe
                        </span>
                        {childCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[color:var(--muted-foreground)]">
                            <Baby size={12} />
                            {childCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[color:var(--muted-foreground)]" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className={`${!mobileShowList ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {view === "add" ? (
          <AddGuestForm isPending={isPending} onBack={onBackToList} onSave={onCreateGuest} />
        ) : view === "edit" && selectedGuest ? (
          <EditGuestRsvpForm
            guestGroup={selectedGuest}
            isPending={isPending}
            onBack={() => onSelectGuest(selectedGuest.id)}
            onSave={(payload) => onSaveRsvp(selectedGuest.id, payload)}
          />
        ) : selectedGuest ? (
          <GuestDetailView
            guestGroup={selectedGuest}
            onBack={onBackToList}
            onEdit={onShowEditGuest}
            onDelete={() => onDeleteGuest(selectedGuest.id)}
            onCopyLink={() => onCopyLink(selectedGuest)}
          />
        ) : (
          <EmptyState
            icon={<Users size={32} />}
            title="Odaberite gosta za prikaz detalja."
            description="Na desktopu lista ostaje otvorena, a na mobitelu se nakon odabira otvaraju detalji."
          />
        )}
      </div>
    </div>
  );
}

function GuestDetailView({
  guestGroup,
  onBack,
  onEdit,
  onDelete,
  onCopyLink,
}: {
  guestGroup: GuestGroupDto;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}) {
  const status = STATUS_META[guestGroup.status];

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={guestGroup.name}
        onBack={onBack}
        action={
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
          >
            Uredi odgovor
          </button>
        }
      />

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 lg:px-8">
        <div className="grid gap-4 xl:grid-cols-2">
          <InfoCard label="Status" value={status.label} valueClassName={status.text} />
          <InfoCard
            label="Pozvane osobe"
            value={`${guestGroup.maxPeople} ${guestGroup.maxPeople === 1 ? "osoba" : "osobe"}`}
          />
          <InfoCard
            label="Potvrđene osobe"
            value={`${guestGroup.attendees.length} ${guestGroup.attendees.length === 1 ? "osoba" : "osobe"}`}
          />
          <InfoCard label="Kontakt" value={guestGroup.contact ?? "Nije unesen"} />
        </div>

        <section className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
          <SectionLabel label="Potvrđeni gosti" />
          <div className="mt-4 space-y-3">
            {guestGroup.attendees.length === 0 ? (
              <p className="text-sm text-[color:var(--muted-foreground)]">
                Još nema potvrđenih osoba za ovu pozivnicu.
              </p>
            ) : (
              guestGroup.attendees.map((attendee) => (
                <div
                  key={attendee.id}
                  className="flex items-center justify-between rounded-[22px] border border-white/80 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-[color:var(--foreground)]">{attendee.name}</p>
                    {attendee.tableName && (
                      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                        Raspoređen za {attendee.tableName}
                      </p>
                    )}
                  </div>
                  {attendee.isChild && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--panel)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
                      <Baby size={12} />
                      dijete
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
          <SectionLabel label="Napomena" />
          <p className="mt-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
            {guestGroup.note || "Nema dodatnih napomena."}
          </p>
        </section>

        <section className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
          <SectionLabel label="Link pozivnice" />
          <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-white/80 bg-white px-4 py-4 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[color:var(--muted-foreground)]">
              {guestGroup.rsvpPath}
            </code>
            <button
              type="button"
              onClick={onCopyLink}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--foreground)] px-4 py-2 text-sm text-[color:var(--background)] transition hover:opacity-90"
            >
              <Copy size={14} />
              Kopiraj
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 transition hover:bg-rose-100"
        >
          <Trash2 size={16} />
          Ukloni gosta
        </button>
      </div>
    </div>
  );
}

function AddGuestForm({
  isPending,
  onBack,
  onSave,
}: {
  isPending: boolean;
  onBack: () => void;
  onSave: (payload: { name: string; maxPeople: number; contact?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [maxPeople, setMaxPeople] = useState(1);
  const [contact, setContact] = useState("");

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Dodaj gosta"
        onBack={onBack}
        action={
          <button
            type="button"
            disabled={!name.trim() || isPending}
            onClick={() =>
              onSave({
                name,
                maxPeople,
                contact,
              })
            }
            className="rounded-full bg-[color:var(--foreground)] px-4 py-2 text-sm text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Dodaj
          </button>
        }
      />
      <div className="space-y-5 overflow-y-auto px-5 py-5 lg:px-8">
        <Field label="Ime gosta ili grupe *">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4 text-base outline-none transition focus:border-[color:var(--accent)]"
            placeholder="Npr. Maja Petrović ili Obitelj Kovač"
          />
        </Field>

        <Field label="Broj osoba na pozivnici *">
          <Stepper value={maxPeople} min={1} max={20} onChange={setMaxPeople} />
        </Field>

        <Field label="Kontakt">
          <input
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            className="w-full rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4 text-base outline-none transition focus:border-[color:var(--accent)]"
            placeholder="Telefon, email ili WhatsApp"
          />
        </Field>
      </div>
    </div>
  );
}

function EditGuestRsvpForm({
  guestGroup,
  isPending,
  onBack,
  onSave,
}: {
  guestGroup: GuestGroupDto;
  isPending: boolean;
  onBack: () => void;
  onSave: (payload: GuestGroupRsvpInput) => void;
}) {
  const [status, setStatus] = useState<RSVPStatus>(guestGroup.status);
  const [note, setNote] = useState(guestGroup.note ?? "");
  const [attendees, setAttendees] = useState(
    guestGroup.attendees.length > 0
      ? guestGroup.attendees.map((attendee) => ({
          name: attendee.name,
          isChild: attendee.isChild,
        }))
      : [{ name: guestGroup.name, isChild: false }],
  );

  function updateAttendee(index: number, field: "name" | "isChild", value: string | boolean) {
    setAttendees((current) =>
      current.map((attendee, attendeeIndex) =>
        attendeeIndex === index ? { ...attendee, [field]: value } : attendee,
      ),
    );
  }

  function addAttendee() {
    if (attendees.length >= guestGroup.maxPeople) {
      return;
    }

    setAttendees((current) => [...current, { name: "", isChild: false }]);
  }

  function removeAttendee(index: number) {
    if (attendees.length === 1) {
      return;
    }

    setAttendees((current) => current.filter((_, attendeeIndex) => attendeeIndex !== index));
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Uredi odgovor"
        onBack={onBack}
        action={
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              onSave({
                status,
                note,
                attendees:
                  status === "confirmed"
                    ? attendees.filter((attendee) => attendee.name.trim())
                    : [],
              })
            }
            className="rounded-full bg-[color:var(--foreground)] px-4 py-2 text-sm text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Spremi
          </button>
        }
      />

      <div className="space-y-5 overflow-y-auto px-5 py-5 lg:px-8">
        <Field label="Status">
          <div className="grid gap-3 sm:grid-cols-3">
            {(["confirmed", "pending", "declined"] as RSVPStatus[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`rounded-[24px] border px-4 py-4 text-sm transition ${
                  status === item
                    ? item === "confirmed"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : item === "pending"
                        ? "border-amber-400 bg-amber-400 text-white"
                        : "border-rose-400 bg-rose-400 text-white"
                    : "border-[color:var(--border)] bg-[color:var(--panel)] text-[color:var(--foreground)]"
                }`}
              >
                {STATUS_META[item].label}
              </button>
            ))}
          </div>
        </Field>

        {status === "confirmed" && (
          <Field label={`Gosti (${attendees.length}/${guestGroup.maxPeople})`}>
            <div className="space-y-3">
              <button
                type="button"
                onClick={addAttendee}
                disabled={attendees.length >= guestGroup.maxPeople}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={16} />
                Dodaj osobu
              </button>

              {attendees.map((attendee, index) => (
                <div
                  key={`${attendee.name}-${index}`}
                  className="rounded-[24px] border border-[color:var(--border)] bg-white p-4"
                >
                  <div className="flex items-start gap-3">
                    <input
                      value={attendee.name}
                      onChange={(event) =>
                        updateAttendee(index, "name", event.target.value)
                      }
                      className="flex-1 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 text-base outline-none transition focus:border-[color:var(--accent)]"
                      placeholder={`Ime i prezime ${index + 1}. gosta`}
                    />
                    <button
                      type="button"
                      onClick={() => removeAttendee(index)}
                      disabled={attendees.length === 1}
                      className="rounded-full border border-[color:var(--border)] p-2 text-[color:var(--muted-foreground)] transition hover:border-rose-300 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <label className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--panel)] px-3 py-2 text-sm text-[color:var(--muted-foreground)]">
                    <input
                      type="checkbox"
                      checked={attendee.isChild}
                      onChange={(event) =>
                        updateAttendee(index, "isChild", event.target.checked)
                      }
                    />
                    <Baby size={16} />
                    Dijete
                  </label>
                </div>
              ))}
            </div>
          </Field>
        )}

        <Field label="Napomena">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            className="w-full rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4 text-base outline-none transition focus:border-[color:var(--accent)]"
            placeholder="Alergije, dodatni zahtjevi, način dolaska..."
          />
        </Field>
      </div>
    </div>
  );
}

function TablesViewPanel({
  tables,
  unassignedAttendees,
  selectedTable,
  view,
  isPending,
  onSelectTable,
  onBackToList,
  onShowAddTable,
  onShowAddPeople,
  onCreateTable,
  onDeleteTable,
  onAssignAttendees,
  onRemoveAttendee,
}: {
  tables: TableDto[];
  unassignedAttendees: TableAttendeeDto[];
  selectedTable: TableDto | null;
  view: TablesView;
  isPending: boolean;
  onSelectTable: (tableId: string) => void;
  onBackToList: () => void;
  onShowAddTable: () => void;
  onShowAddPeople: () => void;
  onCreateTable: (payload: { name: string; seats: number }) => void;
  onDeleteTable: (tableId: string) => void;
  onAssignAttendees: (tableId: string, attendeeIds: string[]) => void;
  onRemoveAttendee: (tableId: string, attendeeId: string) => void;
}) {
  const mobileShowList = view === "list";

  return (
    <div className="flex min-h-[calc(100vh-11rem)] overflow-hidden rounded-[36px] border border-white/70 bg-white/90 shadow-[0_24px_70px_rgba(28,25,23,0.08)]">
      <div
        className={`${
          mobileShowList ? "flex" : "hidden md:flex"
        } w-full shrink-0 flex-col border-r border-[color:var(--border)] md:w-[24rem]`}
      >
        <div className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-white/95 px-5 py-5 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
                Raspored
              </p>
              <h2 className="mt-2 font-display text-4xl text-[color:var(--foreground)]">
                Stolovi
              </h2>
            </div>
            <button
              type="button"
              onClick={onShowAddTable}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--foreground)] px-4 py-2 text-sm text-[color:var(--background)] transition hover:opacity-90"
            >
              <Plus size={16} />
              Dodaj
            </button>
          </div>

          <div className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4 text-sm text-[color:var(--muted-foreground)]">
            <p>
              {tables.reduce((sum, table) => sum + table.occupancy, 0)} /{" "}
              {tables.reduce((sum, table) => sum + table.seats, 0)} mjesta
            </p>
            <p className="mt-2">
              <span className={unassignedAttendees.length > 0 ? "text-amber-700" : "text-emerald-700"}>
                {unassignedAttendees.length} neraspoređenih osoba
              </span>
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {unassignedAttendees.length > 0 && (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm text-amber-900">
                {unassignedAttendees.length} osoba još nije raspoređeno.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-amber-700">
                {unassignedAttendees.slice(0, 4).map((attendee) => (
                  <span key={attendee.id} className="rounded-full bg-white px-3 py-1">
                    {attendee.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {tables.length === 0 ? (
            <EmptyState icon={<LayoutGrid size={28} />} title="Još nema stolova." />
          ) : (
            tables.map((table) => {
              const active = selectedTable?.id === table.id;

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => onSelectTable(table.id)}
                  className={`w-full rounded-[26px] border px-4 py-4 text-left transition ${
                    active
                      ? "border-[color:var(--accent)] bg-[rgba(201,149,106,0.12)]"
                      : "border-[color:var(--border)] bg-[color:var(--panel)] hover:border-[color:var(--accent)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base text-[color:var(--foreground)]">{table.name}</p>
                      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                        {table.occupancy} / {table.seats} osoba
                      </p>
                    </div>
                    {table.isFull && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                        Popunjeno
                      </span>
                    )}
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full ${
                        table.isFull ? "bg-emerald-500" : "bg-[color:var(--accent)]"
                      }`}
                      style={{ width: `${Math.min(100, (table.occupancy / table.seats) * 100)}%` }}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className={`${!mobileShowList ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {view === "addTable" ? (
          <AddTableForm isPending={isPending} onBack={onBackToList} onSave={onCreateTable} />
        ) : view === "addPeople" && selectedTable ? (
          <AddPeopleToTableForm
            table={selectedTable}
            isPending={isPending}
            availableAttendees={unassignedAttendees}
            onBack={() => onSelectTable(selectedTable.id)}
            onSave={(attendeeIds) => onAssignAttendees(selectedTable.id, attendeeIds)}
          />
        ) : selectedTable ? (
          <TableDetailView
            table={selectedTable}
            onBack={onBackToList}
            onAddPeople={onShowAddPeople}
            onDelete={() => onDeleteTable(selectedTable.id)}
            onRemoveAttendee={(attendeeId) => onRemoveAttendee(selectedTable.id, attendeeId)}
          />
        ) : (
          <EmptyState
            icon={<LayoutGrid size={32} />}
            title="Odaberite stol za prikaz detalja."
            description="Ovdje ćete pratiti popunjenost stolova i raspoređivati potvrđene goste."
          />
        )}
      </div>
    </div>
  );
}

function TableDetailView({
  table,
  onBack,
  onAddPeople,
  onDelete,
  onRemoveAttendee,
}: {
  table: TableDto;
  onBack: () => void;
  onAddPeople: () => void;
  onDelete: () => void;
  onRemoveAttendee: (attendeeId: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={table.name}
        onBack={onBack}
        action={
          <button
            type="button"
            disabled={table.freeSeats === 0}
            onClick={onAddPeople}
            className="rounded-full bg-[color:var(--foreground)] px-4 py-2 text-sm text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Dodaj osobe
          </button>
        }
      />
      <div className="space-y-5 overflow-y-auto px-5 py-5 lg:px-8">
        <section className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
          <SectionLabel label="Popunjenost" />
          <div className="mt-4 flex items-center justify-between text-sm text-[color:var(--muted-foreground)]">
            <span>
              {table.occupancy} / {table.seats} osoba
            </span>
            <span>
              {table.freeSeats > 0
                ? `${table.freeSeats} slobodnih mjesta`
                : "Stol je popunjen"}
            </span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
            <div
              className={`h-full rounded-full ${
                table.isFull ? "bg-emerald-500" : "bg-[color:var(--accent)]"
              }`}
              style={{ width: `${Math.min(100, (table.occupancy / table.seats) * 100)}%` }}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
          <SectionLabel label="Za stolom" />
          <div className="mt-4 space-y-3">
            {table.attendees.length === 0 ? (
              <p className="text-sm text-[color:var(--muted-foreground)]">
                Još nema gostiju za ovim stolom.
              </p>
            ) : (
              table.attendees.map((attendee) => (
                <div
                  key={attendee.id}
                  className="flex items-center justify-between gap-3 rounded-[22px] border border-white/80 bg-white px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[color:var(--foreground)]">
                      {attendee.name}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                      {attendee.guestGroupName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {attendee.isChild && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--panel)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
                        <Baby size={12} />
                        dijete
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveAttendee(attendee.id)}
                      className="rounded-full border border-[color:var(--border)] p-2 text-[color:var(--muted-foreground)] transition hover:border-rose-300 hover:text-rose-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 transition hover:bg-rose-100"
        >
          <Trash2 size={16} />
          Ukloni stol
        </button>
      </div>
    </div>
  );
}

function AddPeopleToTableForm({
  table,
  isPending,
  availableAttendees,
  onBack,
  onSave,
}: {
  table: TableDto;
  isPending: boolean;
  availableAttendees: TableAttendeeDto[];
  onBack: () => void;
  onSave: (attendeeIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const canSelectMore = selectedIds.length < table.freeSeats;

  function toggleAttendee(attendeeId: string) {
    setSelectedIds((current) => {
      if (current.includes(attendeeId)) {
        return current.filter((id) => id !== attendeeId);
      }

      if (!canSelectMore) {
        return current;
      }

      return [...current, attendeeId];
    });
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={`Dodaj osobe — ${table.name}`}
        onBack={onBack}
        action={
          <button
            type="button"
            disabled={selectedIds.length === 0 || isPending}
            onClick={() => onSave(selectedIds)}
            className="rounded-full bg-[color:var(--foreground)] px-4 py-2 text-sm text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Dodaj ({selectedIds.length})
          </button>
        }
      />
      <div className="space-y-4 overflow-y-auto px-5 py-5 lg:px-8">
        <p className="text-sm text-[color:var(--muted-foreground)]">
          {table.freeSeats} slobodnih mjesta. Odaberite do {table.freeSeats}{" "}
          {table.freeSeats === 1 ? "osobe" : "osoba"}.
        </p>

        {availableAttendees.length === 0 ? (
          <EmptyState
            icon={<Check size={30} />}
            title="Sve potvrđene osobe već imaju stol."
          />
        ) : (
          <div className="space-y-3">
            {availableAttendees.map((attendee) => {
              const selected = selectedIds.includes(attendee.id);
              const disabled = !selected && !canSelectMore;

              return (
                <button
                  key={attendee.id}
                  type="button"
                  onClick={() => !disabled && toggleAttendee(attendee.id)}
                  className={`flex w-full items-center gap-3 rounded-[24px] border px-4 py-4 text-left transition ${
                    selected
                      ? "border-[color:var(--accent)] bg-[rgba(201,149,106,0.12)]"
                      : disabled
                        ? "cursor-not-allowed border-[color:var(--border)] bg-[color:var(--panel)] opacity-40"
                        : "border-[color:var(--border)] bg-[color:var(--panel)] hover:border-[color:var(--accent)]"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      selected
                        ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                        : "border-[color:var(--border)] bg-white"
                    }`}
                  >
                    {selected && <Check size={12} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[color:var(--foreground)]">{attendee.name}</p>
                    <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                      {attendee.guestGroupName}
                    </p>
                  </div>
                  {attendee.isChild && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
                      <Baby size={12} />
                      dijete
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AddTableForm({
  isPending,
  onBack,
  onSave,
}: {
  isPending: boolean;
  onBack: () => void;
  onSave: (payload: { name: string; seats: number }) => void;
}) {
  const [name, setName] = useState("Stol");
  const [seats, setSeats] = useState(8);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Dodaj stol"
        onBack={onBack}
        action={
          <button
            type="button"
            disabled={!name.trim() || isPending}
            onClick={() => onSave({ name, seats })}
            className="rounded-full bg-[color:var(--foreground)] px-4 py-2 text-sm text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Dodaj
          </button>
        }
      />
      <div className="space-y-5 overflow-y-auto px-5 py-5 lg:px-8">
        <Field label="Naziv stola *">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4 text-base outline-none transition focus:border-[color:var(--accent)]"
            placeholder="Npr. Stol 1, VIP stol, dječji stol..."
          />
        </Field>

        <Field label="Broj mjesta *">
          <Stepper value={seats} min={1} max={50} onChange={setSeats} />
        </Field>
      </div>
    </div>
  );
}

function SettingsViewPanel({
  event,
  isPending,
  onSave,
  onCopyBaseLink,
  onExportGuests,
  onExportBackup,
  onImportGuests,
}: {
  event: OrganizerSnapshot["event"];
  isPending: boolean;
  onSave: (payload: EventSettingsInput) => void;
  onCopyBaseLink: () => void;
  onExportGuests: () => void;
  onExportBackup: () => void;
  onImportGuests: (file: File, mode: ImportMode) => void;
}) {
  const [form, setForm] = useState<EventSettingsInput>({
    name: event.name,
    venue: event.venue,
    date: event.date,
  });
  const [pendingImportMode, setPendingImportMode] = useState<ImportMode>("append");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openImportPicker(mode: ImportMode) {
    setPendingImportMode(mode);
    fileInputRef.current?.click();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <section className="rounded-[36px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_rgba(28,25,23,0.08)] sm:p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
          Podaci o događaju
        </p>
        <h2 className="mt-3 font-display text-5xl text-[color:var(--foreground)]">
          Postavke
        </h2>
        <div className="mt-8 space-y-5">
          <Field label="Naziv događaja">
            <input
              value={form.name}
              onChange={(eventValue) =>
                setForm((current) => ({ ...current, name: eventValue.target.value }))
              }
              className="w-full rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4 text-base outline-none transition focus:border-[color:var(--accent)]"
            />
          </Field>
          <Field label="Datum">
            <input
              type="date"
              value={form.date}
              onChange={(eventValue) =>
                setForm((current) => ({ ...current, date: eventValue.target.value }))
              }
              className="w-full rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4 text-base outline-none transition focus:border-[color:var(--accent)]"
            />
          </Field>
          <Field label="Lokacija">
            <input
              value={form.venue}
              onChange={(eventValue) =>
                setForm((current) => ({ ...current, venue: eventValue.target.value }))
              }
              className="w-full rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4 text-base outline-none transition focus:border-[color:var(--accent)]"
            />
          </Field>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onSave(form)}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[color:var(--foreground)] px-5 py-3 text-sm text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? <Check size={16} /> : null}
          Spremi promjene
        </button>
      </section>

      <section className="space-y-5">
        <div className="rounded-[36px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_rgba(28,25,23,0.08)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Javni RSVP link
          </p>
          <div className="mt-5 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              Ovaj link vodi na javnu stranicu događaja. Svaki gost uz to dobiva i personalizirani RSVP link.
            </p>
            <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-white/80 bg-white px-4 py-4 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[color:var(--muted-foreground)]">
                {event.rsvpBasePath}
              </code>
              <button
                type="button"
                onClick={onCopyBaseLink}
                className="inline-flex items-center gap-2 rounded-full bg-[color:var(--foreground)] px-4 py-2 text-sm text-[color:var(--background)] transition hover:opacity-90"
              >
                <Copy size={14} />
                Kopiraj
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[36px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_rgba(28,25,23,0.08)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Kako funkcionira
          </p>
          <div className="mt-5 space-y-3">
            {[
              "Dodajte gosta i definirajte koliko osoba njegova pozivnica pokriva.",
              "Podijelite personalizirani RSVP link s gostom.",
              "Gost popunjava tko dolazi, označava djecu i dodaje napomene.",
              "Vi pratite potvrde i raspoređujete osobe za stolove u stvarnom vremenu.",
            ].map((step, index) => (
              <div
                key={step}
                className="flex items-start gap-3 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm text-[color:var(--muted-foreground)]">
                  {index + 1}
                </div>
                <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[36px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_rgba(28,25,23,0.08)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Import i export
          </p>
          <div className="mt-5 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              Preuzmite CSV za uređivanje gostiju u tablici ili napravite puni JSON backup prije većih promjena.
            </p>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted-foreground)]">
              CSV koristi stupce <code>name</code>, <code>maxPeople</code>, <code>contact</code>, <code>status</code>, <code>note</code>, <code>attendees</code> i <code>children</code>. Više osoba u jednom polju odvojite s <code>|</code>.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(eventValue) => {
                const file = eventValue.target.files?.[0];

                if (file) {
                  onImportGuests(file, pendingImportMode);
                }

                eventValue.target.value = "";
              }}
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={isPending}
                onClick={onExportGuests}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--foreground)] px-4 py-3 text-sm text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={16} />
                Izvezi goste CSV
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={onExportBackup}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={16} />
                Preuzmi backup JSON
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => openImportPicker("append")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Upload size={16} />
                Uvezi CSV i dodaj
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => openImportPicker("replace")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Upload size={16} />
                Uvezi CSV i zamijeni
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PanelHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[color:var(--border)] bg-white/95 px-5 py-4 backdrop-blur lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full border border-[color:var(--border)] p-2 text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] md:hidden"
      >
        <ChevronRight size={16} className="rotate-180" />
      </button>
      <h3 className="min-w-0 flex-1 truncate font-display text-4xl text-[color:var(--foreground)]">
        {title}
      </h3>
      {action}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-3 block text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
      {label}
    </p>
  );
}

function InfoCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className={`mt-3 text-lg text-[color:var(--foreground)] ${valueClassName ?? ""}`}>
        {value}
      </p>
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--panel)] p-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)] bg-white text-lg text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
      >
        -
      </button>
      <div className="flex-1 text-center font-display text-5xl text-[color:var(--foreground)]">
        {value}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)] bg-white text-lg text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
      >
        +
      </button>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 px-6 text-center text-[color:var(--muted-foreground)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[color:var(--panel)] text-[color:var(--foreground)]">
        {icon}
      </div>
      <p className="text-sm">{title}</p>
      {description && <p className="max-w-sm text-sm leading-7">{description}</p>}
    </div>
  );
}
