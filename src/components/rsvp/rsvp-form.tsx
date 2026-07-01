"use client";

import { useState, useTransition } from "react";
import { Check, Minus, Plus } from "lucide-react";

import { getErrorMessage } from "@/lib/errors";
import type { PublicRsvpSnapshot, RSVPStatus } from "@/lib/types";

interface RsvpFormProps {
  initialData: PublicRsvpSnapshot;
  mode?: "live" | "demo";
  showPresets?: boolean;
}

type LocalAttendee = {
  name: string;
  isChild: boolean;
};

type DemoPreset = "step1" | "step2" | "step3" | "declined";

type FormState = {
  status: RSVPStatus;
  primaryName: string;
  companions: LocalAttendee[];
  note: string;
};

const demoPresets: Record<DemoPreset, FormState> = {
  step1: {
    status: "confirmed",
    primaryName: "Marko Gelo",
    companions: [],
    note: "",
  },
  step2: {
    status: "confirmed",
    primaryName: "Marko Gelo",
    companions: [{ name: "Lucija Gelo", isChild: true }],
    note: "",
  },
  step3: {
    status: "confirmed",
    primaryName: "Marko Gelo",
    companions: [
      { name: "Lucija Gelo", isChild: true },
      { name: "Klara Gelo", isChild: false },
    ],
    note: "",
  },
  declined: {
    status: "declined",
    primaryName: "Marko Gelo",
    companions: [],
    note: "Nećemo biti u mogućnosti doći, ali vam želimo prekrasan dan.",
  },
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function getInitialFormState(snapshot: PublicRsvpSnapshot): FormState {
  const savedAttendees = snapshot.guestGroup.attendees.map((attendee) => ({
    name: attendee.name,
    isChild: attendee.isChild,
  }));

  if (savedAttendees.length === 0) {
    return {
      status: snapshot.guestGroup.status,
      primaryName: snapshot.guestGroup.name,
      companions: [],
      note: snapshot.guestGroup.note ?? "",
    };
  }

  const primaryAttendeeIndex = savedAttendees.findIndex(
    (attendee) => normalizeName(attendee.name) === normalizeName(snapshot.guestGroup.name),
  );
  const resolvedPrimaryIndex = primaryAttendeeIndex >= 0 ? primaryAttendeeIndex : 0;
  const primaryAttendee = savedAttendees[resolvedPrimaryIndex];
  const companions = savedAttendees.filter((_, index) => index !== resolvedPrimaryIndex);

  return {
    status: snapshot.guestGroup.status,
    primaryName: primaryAttendee.name,
    companions,
    note: snapshot.guestGroup.note ?? "",
  };
}

function buildAttendees(primaryName: string, companions: LocalAttendee[]) {
  return [{ name: primaryName.trim(), isChild: false }, ...companions]
    .filter((attendee) => attendee.name.trim())
    .map((attendee) => ({
      name: attendee.name.trim(),
      isChild: attendee.isChild,
    }));
}

function getStatusButtonClasses(selected: boolean) {
  return [
    "flex w-full items-center gap-3 rounded-[14px] border bg-white px-4 py-4 text-left transition",
    selected
      ? "border-[#6f4d20] shadow-[0_0_0_1px_rgba(111,77,32,0.08)]"
      : "border-[#d8d0c7] hover:border-[#bfa886]",
  ].join(" ");
}

function getInputClasses() {
  return [
    "w-full rounded-[10px] border border-[#d9d0c7] bg-white px-4 py-4 text-[17px] text-[#5b401c] outline-none transition",
    "placeholder:text-[#c5baaf] focus:border-[#9d7b4a] focus-visible:ring-2 focus-visible:ring-[#d7bf93]/45",
  ].join(" ");
}

export function RsvpForm({
  initialData,
  mode = "live",
  showPresets = false,
}: RsvpFormProps) {
  const initialState = getInitialFormState(initialData);
  const [status, setStatus] = useState<RSVPStatus>(initialState.status);
  const [primaryName, setPrimaryName] = useState(initialState.primaryName);
  const [companions, setCompanions] = useState<LocalAttendee[]>(initialState.companions);
  const [note, setNote] = useState(initialState.note);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<DemoPreset | null>(
    showPresets ? "step1" : null,
  );
  const [isPending, startTransition] = useTransition();

  const maxAdditionalGuests = Math.max(initialData.guestGroup.maxPeople - 1, 0);
  const canAddCompanions =
    status === "confirmed" && companions.length < maxAdditionalGuests;

  function clearFeedback() {
    setError(null);
    setSuccess(null);
  }

  function setDemoPreset(preset: DemoPreset) {
    const next = demoPresets[preset];

    clearFeedback();
    setActivePreset(preset);
    setStatus(next.status);
    setPrimaryName(next.primaryName);
    setCompanions(next.companions);
    setNote(next.note);
  }

  function updateCompanion(
    index: number,
    field: keyof LocalAttendee,
    value: string | boolean,
  ) {
    clearFeedback();
    setCompanions((current) =>
      current.map((attendee, attendeeIndex) =>
        attendeeIndex === index
          ? {
              ...attendee,
              [field]: value,
            }
          : attendee,
      ),
    );
  }

  function addCompanion() {
    if (!canAddCompanions) {
      return;
    }

    clearFeedback();
    setCompanions((current) => [...current, { name: "", isChild: false }]);
    setActivePreset(null);
  }

  function removeCompanion(index: number) {
    clearFeedback();
    setCompanions((current) => current.filter((_, attendeeIndex) => attendeeIndex !== index));
    setActivePreset(null);
  }

  function handleStatusChange(nextStatus: RSVPStatus) {
    clearFeedback();
    setStatus(nextStatus);
    setActivePreset(null);

    if (nextStatus !== "confirmed") {
      setCompanions([]);
    }
  }

  function submit() {
    clearFeedback();

    if (status === "pending") {
      setError("Odaberite dolazite li na događaj.");
      return;
    }

    if (status === "confirmed" && !primaryName.trim()) {
      setError("Unesite svoje ime i prezime.");
      return;
    }

    const payload = {
      status,
      note: note.trim(),
      attendees:
        status === "confirmed" ? buildAttendees(primaryName, companions) : [],
    };

    startTransition(async () => {
      try {
        if (mode === "demo") {
          await Promise.resolve();
          setSuccess("Demo odgovor je spremljen lokalno. Slobodno nastavite testirati.");
          return;
        }

        const response = await fetch(`/api/rsvp/${initialData.guestGroup.shareToken}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Spremanje nije uspjelo.");
        }

        setSuccess("Odgovor je uspješno spremljen. Hvala vam!");
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      {showPresets && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2 rounded-[18px] border border-[#d8d0c7] bg-[#fbf8f3] p-2">
          {[
            { key: "step1" as const, label: "Step 1" },
            { key: "step2" as const, label: "Step 2" },
            { key: "step3" as const, label: "Step 3" },
            { key: "declined" as const, label: "Ne mogu" },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setDemoPreset(preset.key)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                activePreset === preset.key
                  ? "bg-[#6f4d20] text-white"
                  : "bg-white text-[#6f4d20] hover:bg-[#f2e7d2]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.42em] text-[#be9b58]">RSVP</p>
        <h1 className="mt-4 font-display text-[3rem] leading-[0.95] text-[#5b401c] sm:text-[4.4rem]">
          Potvrdite dolazak
        </h1>
        <p className="mt-4 text-lg text-[#6b5436] sm:text-[1.9rem]">
          Molimo potvrdite do 1. rujna 2026.
        </p>
      </div>

      <div className="mt-12 space-y-7">
        <section className="rounded-[18px] border border-[#e4ddd5] bg-[#fbf9f6] p-5 sm:p-6">
          <p className="text-[12px] uppercase tracking-[0.2em] text-[#8d7350]">
            Dolazite li?
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleStatusChange("confirmed")}
              className={getStatusButtonClasses(status === "confirmed")}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-[3px] border text-white ${
                  status === "confirmed"
                    ? "border-[#6f4d20] bg-[#6f4d20]"
                    : "border-[#b7a48d] bg-white text-transparent"
                }`}
              >
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="text-[1.05rem] text-[#5b401c]">Dolazim</span>
            </button>

            <button
              type="button"
              onClick={() => handleStatusChange("declined")}
              className={getStatusButtonClasses(status === "declined")}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-[3px] border text-white ${
                  status === "declined"
                    ? "border-[#6f4d20] bg-[#6f4d20]"
                    : "border-[#b7a48d] bg-white text-transparent"
                }`}
              >
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="text-[1.05rem] text-[#5b401c]">Ne mogu</span>
            </button>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#e4ddd5] bg-[#fbf9f6] p-5 sm:p-6">
          <label className="block text-[12px] uppercase tracking-[0.2em] text-[#8d7350]">
            Vaše ime i prezime
          </label>
          <input
            value={primaryName}
            onChange={(event) => {
              clearFeedback();
              setPrimaryName(event.target.value);
              setActivePreset(null);
            }}
            className={`${getInputClasses()} mt-3`}
            placeholder="Unesite ime i prezime"
          />
        </section>

        {status === "confirmed" && (
          <section className="rounded-[18px] border border-[#e4ddd5] bg-[#fbf9f6] p-5 sm:p-6">
            <p className="text-[12px] uppercase tracking-[0.2em] text-[#5b401c]">
              Osobe koje dolaze s vama
            </p>
            <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1 text-[#5b401c]">
              <span className="text-[2rem] leading-none">
                {companions.length}/{maxAdditionalGuests}
              </span>
              <span className="pb-1 text-[1.05rem] text-[#b29c84]">dodatne osobe</span>
            </div>
            <p className="mt-2 text-[1.02rem] leading-7 text-[#6b5436]">
              {maxAdditionalGuests > 0
                ? "Vi ste već uneseni kao gost. Možete dodati još do 3 osobe koje dolaze s vama."
                : "Ova pozivnica vrijedi samo za vas pa dodatne osobe nisu dostupne."}
            </p>

            {companions.length > 0 && (
              <div className="mt-6 space-y-5">
                {companions.map((attendee, index) => (
                  <article
                    key={`${attendee.name}-${index}`}
                    className="rounded-[16px] border border-[#dfd4c7] bg-white p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[12px] uppercase tracking-[0.18em] text-[#6b5436]">
                        {index + 1}. osoba
                      </p>
                      <button
                        type="button"
                        onClick={() => removeCompanion(index)}
                        className="text-left text-[0.9rem] uppercase tracking-[0.08em] text-[#ff3b1d] transition hover:opacity-75"
                      >
                        Ukloni gosta
                      </button>
                    </div>

                    <input
                      value={attendee.name}
                      onChange={(event) => {
                        setActivePreset(null);
                        updateCompanion(index, "name", event.target.value);
                      }}
                      className={`${getInputClasses()} mt-3`}
                      placeholder={`Gost ${index + 1}`}
                    />

                    <div className="mt-3 flex flex-col gap-3 rounded-[10px] bg-[#faf7f2] px-3 py-2.5 text-[#6b5436] sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[0.98rem]">Je li ova osoba dijete?</p>
                      <div className="flex items-center gap-7">
                        {[
                          { label: "Da", value: true },
                          { label: "Ne", value: false },
                        ].map((option) => {
                          const selected = attendee.isChild === option.value;

                          return (
                            <button
                              key={option.label}
                              type="button"
                              onClick={() => {
                                setActivePreset(null);
                                updateCompanion(index, "isChild", option.value);
                              }}
                              className="inline-flex items-center gap-2 text-[0.98rem]"
                            >
                              <span
                                className={`size-3 rounded-full border ${
                                  selected
                                    ? "border-[#6f4d20] bg-[#6f4d20]"
                                    : "border-[#8b7658] bg-white"
                                }`}
                              />
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {maxAdditionalGuests > 0 && (
              <button
                type="button"
                onClick={addCompanion}
                disabled={!canAddCompanions}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 border border-[#9b8159] bg-white px-4 py-4 text-[0.98rem] uppercase tracking-[0.04em] text-[#5b401c] transition hover:bg-[#fbf4e8] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Plus size={18} />
                Dodaj dodatnu osobu
              </button>
            )}
          </section>
        )}

        <section className="space-y-3">
          <label className="block text-[12px] uppercase tracking-[0.2em] text-[#8d7350]">
            Poruka za mladence (neobavezno)
          </label>
          <textarea
            value={note}
            onChange={(event) => {
              clearFeedback();
              setNote(event.target.value);
              setActivePreset(null);
            }}
            rows={3}
            className={`${getInputClasses()} resize-y`}
            placeholder="Vaša poruka"
          />
        </section>

        {error && (
          <div className="rounded-[14px] border border-[#f0c8c0] bg-[#fff5f3] px-4 py-3 text-sm text-[#a64536]">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-[14px] border border-[#d6e7cf] bg-[#f6fbf4] px-4 py-3 text-sm text-[#426238]">
            {success}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="inline-flex w-full items-center justify-center gap-2 bg-[#c58d06] px-6 py-5 text-[1rem] font-medium uppercase tracking-[0.06em] text-white transition hover:bg-[#af7c05] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isPending ? (
            <>
              <Minus size={18} />
              Spremam odgovor
            </>
          ) : status === "declined" ? (
            "Pošalji odgovor"
          ) : (
            "Potvrdi dolazak"
          )}
        </button>
      </div>
    </div>
  );
}
