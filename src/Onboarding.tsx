import { useMemo, useState, type FormEvent } from "react";
import { createId, getDailyGoal } from "./appState";
import { useI18n } from "./i18n";
import type { Container, UserProfile } from "./types";

type OnboardingProps = {
  cloudCleanupPending: boolean;
  onComplete: (profile: UserProfile, container: Container) => void;
};

function readPositiveNumber(value: string): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export default function Onboarding({
  cloudCleanupPending,
  onComplete,
}: OnboardingProps) {
  const { locale, t } = useI18n();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goalMode, setGoalMode] = useState<UserProfile["goalMode"]>("formula");
  const [customGoal, setCustomGoal] = useState("");
  const [containerName, setContainerName] = useState("");
  const [containerVolume, setContainerVolume] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const parsedHeight = readPositiveNumber(height);
  const parsedWeight = readPositiveNumber(weight);
  const parsedCustomGoal = readPositiveNumber(customGoal);
  const parsedContainerVolume = readPositiveNumber(containerVolume);
  const formulaGoal = useMemo(() => {
    if (!parsedHeight || !parsedWeight) return null;
    return getDailyGoal({
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      goalMode: "formula",
      customGoalMl: null,
    });
  }, [parsedHeight, parsedWeight]);

  const isValid = Boolean(
    parsedHeight &&
      parsedWeight &&
      (goalMode === "formula" || parsedCustomGoal) &&
      containerName.trim() &&
      parsedContainerVolume,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowErrors(true);
    if (!isValid || !parsedHeight || !parsedWeight || !parsedContainerVolume) {
      return;
    }

    onComplete(
      {
        heightCm: parsedHeight,
        weightKg: parsedWeight,
        goalMode,
        customGoalMl: goalMode === "custom" ? parsedCustomGoal : null,
      },
      {
        id: createId("container"),
        name: containerName.trim(),
        volumeMl: parsedContainerVolume,
      },
    );
  }

  return (
    <main className="onboarding-shell">
      <div className="onboarding-orb orb-one" aria-hidden="true" />
      <div className="onboarding-orb orb-two" aria-hidden="true" />

      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="brand-lockup">
          <span className="drop-logo" aria-hidden="true">水</span>
          <span>drink water</span>
        </div>

        {cloudCleanupPending ? (
          <p className="cloud-cleanup-notice" role="status">
            {t("onboarding.cleanupNotice")}
          </p>
        ) : null}

        <div className="onboarding-intro">
          <p className="overline">{t("onboarding.eyebrow")}</p>
          <h1 id="onboarding-title">{t("onboarding.titleLine1")}<br />{t("onboarding.titleLine2")}</h1>
          <p>{t("onboarding.description")}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset className="form-section">
            <legend><span>1</span> {t("onboarding.stepYou")}</legend>
            <div className="field-grid">
              <label className="field">
                <span>{t("onboarding.height")}</span>
                <span className="input-with-unit">
                  <input
                    inputMode="decimal"
                    min="1"
                    name="height"
                    onChange={(event) => setHeight(event.target.value)}
                    placeholder="170"
                    type="number"
                    value={height}
                  />
                  <small>cm</small>
                </span>
              </label>
              <label className="field">
                <span>{t("onboarding.weight")}</span>
                <span className="input-with-unit">
                  <input
                    inputMode="decimal"
                    min="1"
                    name="weight"
                    onChange={(event) => setWeight(event.target.value)}
                    placeholder="65"
                    type="number"
                    value={weight}
                  />
                  <small>kg</small>
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend><span>2</span> {t("onboarding.stepGoal")}</legend>
            <div className="segmented-control" aria-label={t("onboarding.goalModeAria")}>
              <label className={goalMode === "formula" ? "selected" : ""}>
                <input
                  checked={goalMode === "formula"}
                  name="goal-mode"
                  onChange={() => setGoalMode("formula")}
                  type="radio"
                />
                {t("onboarding.autoGoal")}
              </label>
              <label className={goalMode === "custom" ? "selected" : ""}>
                <input
                  checked={goalMode === "custom"}
                  name="goal-mode"
                  onChange={() => setGoalMode("custom")}
                  type="radio"
                />
                {t("onboarding.customGoal")}
              </label>
            </div>

            {goalMode === "formula" ? (
              <div className="goal-preview" aria-live="polite">
                <div>
                  <small>{t("onboarding.suggested")}</small>
                  <strong>{formulaGoal ? formulaGoal.toLocaleString(locale) : "—"}<span> mL</span></strong>
                </div>
                <p>{t("onboarding.formula")}</p>
              </div>
            ) : (
              <label className="field full-width">
                <span>{t("onboarding.customDailyGoal")}</span>
                <span className="input-with-unit">
                  <input
                    inputMode="numeric"
                    min="1"
                    name="custom-goal"
                    onChange={(event) => setCustomGoal(event.target.value)}
                    placeholder="2000"
                    type="number"
                    value={customGoal}
                  />
                  <small>mL</small>
                </span>
              </label>
            )}
          </fieldset>

          <fieldset className="form-section">
            <legend><span>3</span> {t("onboarding.stepContainer")}</legend>
            <p className="field-help">{t("onboarding.containerHelp")}</p>
            <div className="field-grid container-fields">
              <label className="field">
                <span>{t("onboarding.containerName")}</span>
                <input
                  name="container-name"
                  onChange={(event) => setContainerName(event.target.value)}
                  placeholder={t("onboarding.containerExample")}
                  type="text"
                  value={containerName}
                />
              </label>
              <label className="field">
                <span>{t("onboarding.capacity")}</span>
                <span className="input-with-unit">
                  <input
                    inputMode="numeric"
                    min="1"
                    name="container-volume"
                    onChange={(event) => setContainerVolume(event.target.value)}
                    placeholder="600"
                    type="number"
                    value={containerVolume}
                  />
                  <small>mL</small>
                </span>
              </label>
            </div>
          </fieldset>

          {showErrors && !isValid ? (
            <p className="form-error" role="alert">{t("onboarding.validation")}</p>
          ) : null}

          <button className="primary-button onboarding-submit" type="submit">
            {t("onboarding.submit")} <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </main>
  );
}
