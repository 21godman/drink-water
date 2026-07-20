import { useMemo, useState, type FormEvent } from "react";
import { createId, getDailyGoal } from "./appState";
import type { Container, UserProfile } from "./types";

type OnboardingProps = {
  onComplete: (profile: UserProfile, container: Container) => void;
};

function readPositiveNumber(value: string): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
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

        <div className="onboarding-intro">
          <p className="overline">第一次設定</p>
          <h1 id="onboarding-title">找到適合你的<br />每日喝水節奏</h1>
          <p>不用帳號，花一分鐘完成設定。資料只會保存在這台裝置的瀏覽器。</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset className="form-section">
            <legend><span>1</span> 先認識你</legend>
            <div className="field-grid">
              <label className="field">
                <span>身高</span>
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
                <span>體重</span>
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
            <legend><span>2</span> 設定每日目標</legend>
            <div className="segmented-control" aria-label="每日目標計算方式">
              <label className={goalMode === "formula" ? "selected" : ""}>
                <input
                  checked={goalMode === "formula"}
                  name="goal-mode"
                  onChange={() => setGoalMode("formula")}
                  type="radio"
                />
                自動計算
              </label>
              <label className={goalMode === "custom" ? "selected" : ""}>
                <input
                  checked={goalMode === "custom"}
                  name="goal-mode"
                  onChange={() => setGoalMode("custom")}
                  type="radio"
                />
                自訂目標
              </label>
            </div>

            {goalMode === "formula" ? (
              <div className="goal-preview" aria-live="polite">
                <div>
                  <small>依身高與體重建議</small>
                  <strong>{formulaGoal ? formulaGoal.toLocaleString() : "—"}<span> mL</span></strong>
                </div>
                <p>（身高＋體重）× 10</p>
              </div>
            ) : (
              <label className="field full-width">
                <span>自訂每日目標</span>
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
            <legend><span>3</span> 加入常用容器</legend>
            <p className="field-help">完成後可以在設定中繼續新增。</p>
            <div className="field-grid container-fields">
              <label className="field">
                <span>容器名稱</span>
                <input
                  name="container-name"
                  onChange={(event) => setContainerName(event.target.value)}
                  placeholder="例如：藍色水壺"
                  type="text"
                  value={containerName}
                />
              </label>
              <label className="field">
                <span>容量</span>
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
            <p className="form-error" role="alert">請填妥身高、體重、目標與至少一個容器。</p>
          ) : null}

          <button className="primary-button onboarding-submit" type="submit">
            開始記錄喝水 <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </main>
  );
}
