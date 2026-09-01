import { useEffect, useState, type Dispatch, type FormEvent } from "react";
import { createId, getDailyGoal } from "./appState";
import CloudReminderCard from "./CloudReminderCard";
import type { CloudReminders } from "./cloudTypes";
import { languageOptions, useI18n } from "./i18n";
import type {
  AppAction,
  AppState,
  Container,
  UserProfile,
} from "./types";
import type { PwaStatus } from "./usePwaStatus";

type SettingsViewProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onClearData: () => Promise<void>;
  pwa: Pick<
    PwaStatus,
    "canInstall" | "installMode" | "install" | "isInstalled"
  >;
  cloud: CloudReminders;
};

type PwaInstallCardProps = Pick<
  PwaStatus,
  "canInstall" | "installMode" | "install"
>;

export function PwaInstallCard({
  canInstall,
  installMode,
  install,
}: PwaInstallCardProps) {
  const { t } = useI18n();
  if (!canInstall) return null;

  const nativeInstall = installMode === "native";
  const description = nativeInstall
    ? t("install.nativeDescription")
    : installMode === "ios-safari"
      ? t("install.iosSafariDescription")
      : t("install.iosOtherDescription");

  return (
    <section className="settings-card install-card" aria-labelledby="install-title">
      <div className="settings-heading">
        <span className="settings-icon" aria-hidden="true">⇩</span>
        <div>
          <h2 id="install-title">{t("install.title")}</h2>
          <p>{t("install.subtitle")}</p>
        </div>
      </div>
      <div className="install-card-content">
        <p>{description}</p>
        {nativeInstall ? (
          <button className="secondary-button" type="button" onClick={() => void install()}>
            {t("install.button")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ContainerDialog({
  container,
  canDelete,
  dispatch,
  onClose,
}: {
  container: Container | null;
  canDelete: boolean;
  dispatch: Dispatch<AppAction>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(container?.name ?? "");
  const [volume, setVolume] = useState(container ? String(container.volumeMl) : "");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedVolume = Number(volume);
    if (!name.trim() || !Number.isFinite(parsedVolume) || parsedVolume <= 0) {
      setError(t("container.invalid"));
      return;
    }

    dispatch(
      container
        ? {
            type: "updateContainer",
            container: { ...container, name: name.trim(), volumeMl: parsedVolume },
          }
        : {
            type: "addContainer",
            container: { id: createId("container"), name: name.trim(), volumeMl: parsedVolume },
          },
    );
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="container-dialog-title">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-heading">
          <div><p className="overline">{t("container.eyebrow")}</p><h2 id="container-dialog-title">{container ? t("container.editTitle") : t("container.addTitle")}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("container.close")}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="field"><span>{t("container.name")}</span><input type="text" value={name} placeholder={t("container.example")} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>{t("container.capacity")}</span><span className="input-with-unit"><input min="1" inputMode="numeric" type="number" value={volume} placeholder="350" onChange={(event) => setVolume(event.target.value)} /><small>mL</small></span></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="dialog-actions">
            {container ? (
              <button
                className="danger-button"
                disabled={!canDelete}
                title={!canDelete ? t("container.addFirstTitle") : undefined}
                type="button"
                onClick={() => {
                  dispatch({ type: "deleteContainer", id: container.id });
                  onClose();
                }}
              >{t("container.delete")}</button>
            ) : <span />}
            <button className="primary-button" type="submit">{container ? t("common.saveChanges") : t("container.add")}</button>
          </div>
          {container && !canDelete ? <p className="last-container-note">{t("container.keepOne")}</p> : null}
        </form>
      </section>
    </div>
  );
}

export default function SettingsView({
  state,
  dispatch,
  onClearData,
  pwa,
  cloud,
}: SettingsViewProps) {
  const { locale, t } = useI18n();
  const profile = state.profile!;
  const [height, setHeight] = useState(String(profile.heightCm));
  const [weight, setWeight] = useState(String(profile.weightKg));
  const [goalMode, setGoalMode] = useState<UserProfile["goalMode"]>(profile.goalMode);
  const [customGoal, setCustomGoal] = useState(profile.customGoalMl ? String(profile.customGoalMl) : "");
  const [profileStatus, setProfileStatus] = useState<"invalid" | "updated" | null>(null);
  const [containerDialog, setContainerDialog] = useState<Container | "new" | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearError, setClearError] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    setHeight(String(profile.heightCm));
    setWeight(String(profile.weightKg));
    setGoalMode(profile.goalMode);
    setCustomGoal(profile.customGoalMl ? String(profile.customGoalMl) : "");
  }, [profile]);

  const draftProfile: UserProfile = {
    heightCm: Number(height),
    weightKg: Number(weight),
    goalMode,
    customGoalMl: customGoal ? Number(customGoal) : null,
  };
  const draftValid =
    draftProfile.heightCm > 0 &&
    draftProfile.weightKg > 0 &&
    (goalMode === "formula" || Boolean(draftProfile.customGoalMl && draftProfile.customGoalMl > 0));

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftValid) {
      setProfileStatus("invalid");
      return;
    }
    dispatch({ type: "updateProfile", profile: draftProfile });
    setProfileStatus("updated");
  }

  return (
    <div className="view-shell settings-view">
      <header className="app-header"><div><p className="overline">{t("settings.eyebrow")}</p><h1>{t("settings.heading")}</h1></div></header>

      <section className="settings-card" aria-labelledby="profile-title">
        <div className="settings-heading"><span className="settings-icon" aria-hidden="true">◎</span><div><h2 id="profile-title">{t("settings.profileTitle")}</h2><p>{t("settings.currentGoal", { amount: getDailyGoal(profile).toLocaleString(locale) })}</p></div></div>
        <form onSubmit={saveProfile}>
          <div className="field-grid">
            <label className="field"><span>{t("onboarding.height")}</span><span className="input-with-unit"><input min="1" type="number" value={height} onChange={(event) => { setHeight(event.target.value); setProfileStatus(null); }} /><small>cm</small></span></label>
            <label className="field"><span>{t("onboarding.weight")}</span><span className="input-with-unit"><input min="1" type="number" value={weight} onChange={(event) => { setWeight(event.target.value); setProfileStatus(null); }} /><small>kg</small></span></label>
          </div>
          <div className="segmented-control settings-segment" aria-label={t("onboarding.goalModeAria")}>
            <label className={goalMode === "formula" ? "selected" : ""}><input type="radio" name="settings-goal-mode" checked={goalMode === "formula"} onChange={() => { setGoalMode("formula"); setProfileStatus(null); }} />{t("onboarding.autoGoal")}</label>
            <label className={goalMode === "custom" ? "selected" : ""}><input type="radio" name="settings-goal-mode" checked={goalMode === "custom"} onChange={() => { setGoalMode("custom"); setProfileStatus(null); }} />{t("onboarding.customGoal")}</label>
          </div>
          {goalMode === "custom" ? <label className="field full-width"><span>{t("onboarding.customDailyGoal")}</span><span className="input-with-unit"><input min="1" type="number" value={customGoal} onChange={(event) => { setCustomGoal(event.target.value); setProfileStatus(null); }} /><small>mL</small></span></label> : (
            <div className="formula-note"><span>{t("settings.formulaSuggested")}</span><strong>{draftValid ? getDailyGoal(draftProfile).toLocaleString(locale) : "—"} mL</strong><small>{t("onboarding.formula")}</small></div>
          )}
          <div className="settings-save-row"><span className={profileStatus === "updated" ? "success-message" : "form-error"} role={profileStatus === "invalid" ? "alert" : "status"}>{profileStatus ? t(profileStatus === "updated" ? "settings.updated" : "settings.invalidProfile") : ""}</span><button className="secondary-button" type="submit">{t("settings.saveProfile")}</button></div>
        </form>
      </section>

      <CloudReminderCard
        settings={state.reminderSettings}
        dispatch={dispatch}
        cloud={cloud}
        pwa={pwa}
      />

      <section className="settings-card" aria-labelledby="containers-title">
        <div className="settings-heading"><span className="settings-icon" aria-hidden="true">▱</span><div><h2 id="containers-title">{t("settings.containersTitle")}</h2><p>{t("settings.containersDescription")}</p></div><button className="small-add-button" type="button" onClick={() => setContainerDialog("new")}>{t("settings.add")}</button></div>
        <ul className="settings-container-list">
          {state.containers.map((container, index) => (
            <li key={container.id}>
              <span className={`tiny-vessel vessel-${(index % 3) + 1}`} aria-hidden="true" />
              <span><strong>{container.name}</strong><small>{container.volumeMl.toLocaleString(locale)} mL</small></span>
              <button className="text-button" type="button" onClick={() => setContainerDialog(container)} aria-label={t("settings.editContainerAria", { name: container.name })}>{t("settings.edit")}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card language-card" aria-labelledby="language-title">
        <div className="settings-heading"><span className="settings-icon" aria-hidden="true">文</span><div><h2 id="language-title">{t("settings.languageTitle")}</h2><p>{t("settings.languageDescription")}</p></div></div>
        <div className="segmented-control settings-segment language-options" aria-label={t("settings.languageAria")}>
          {languageOptions.map((option) => (
            <label className={state.language === option.value ? "selected" : ""} key={option.value}>
              <input type="radio" name="app-language" checked={state.language === option.value} onChange={() => dispatch({ type: "setLanguage", language: option.value })} />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <PwaInstallCard {...pwa} />

      <section className="settings-card data-card" aria-labelledby="local-data-title">
        <div className="settings-heading"><span className="settings-icon" aria-hidden="true">▤</span><div><h2 id="local-data-title">{t("settings.localDataTitle")}</h2><p>{t("settings.localDataDescription")}</p></div></div>
        <p className="data-note">
          {t("settings.localDataNote")}
        </p>
        <button className="clear-data-button" type="button" onClick={() => setShowClearDialog(true)}>{t("settings.clearData")}</button>
      </section>

      {containerDialog ? <ContainerDialog container={containerDialog === "new" ? null : containerDialog} canDelete={state.containers.length > 1} dispatch={dispatch} onClose={() => setContainerDialog(null)} /> : null}
      {showClearDialog ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isClearing) setShowClearDialog(false);
        }}>
          <section className="bottom-sheet confirmation-sheet" role="alertdialog" aria-modal="true" aria-labelledby="clear-data-title" aria-describedby="clear-data-description">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-heading">
              <div><p className="overline danger-overline">{t("settings.irreversible")}</p><h2 id="clear-data-title">{t("settings.clearTitle")}</h2></div>
              <button className="icon-button" disabled={isClearing} type="button" onClick={() => setShowClearDialog(false)} aria-label={t("settings.closeClear")}>×</button>
            </div>
            <p id="clear-data-description" className="confirmation-copy">
              {t("settings.clearDescription")}
            </p>
            {clearError ? <p className="form-error" role="alert">{clearError}</p> : null}
            <div className="confirmation-actions">
              <button className="secondary-button" disabled={isClearing} type="button" onClick={() => setShowClearDialog(false)}>{t("common.cancel")}</button>
              <button
                className="confirm-danger-button"
                disabled={isClearing}
                type="button"
                onClick={async () => {
                  setIsClearing(true);
                  setClearError("");
                  try {
                    await onClearData();
                    setShowClearDialog(false);
                  } catch (error) {
                    setClearError(error instanceof Error ? error.message : t("settings.clearFallback"));
                  } finally {
                    setIsClearing(false);
                  }
                }}
              >{isClearing ? t("settings.clearing") : t("settings.confirmClear")}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
