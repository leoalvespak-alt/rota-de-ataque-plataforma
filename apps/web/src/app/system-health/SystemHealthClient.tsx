"use client";
import {
  ConfirmDestructiveDialog,
  HealthDial,
  IntegrationState,
  KpiCard,
  KpiRow,
  LiveBadge,
  PageHeader,
  QuotaMeter,
  RunbookLink as UiRunbookLink,
  StatusBadge,
} from "@plataforma/ui-bridge";
import { useState } from "react";
import { appPath } from "@/lib/base-path";
import type { IntegrationCapability } from "@/lib/integration-capabilities";
interface Heartbeat {
  worker: string;
  instance_id: string;
  last_beat_at: string;
  jobs_done_window: number;
  jobs_failed_window: number;
  backlog_seen: number;
  p95_latency_ms: string;
  state: string;
}
interface Alert {
  id: string;
  kind: string;
  severity: string;
  created_at: string;
}
interface Canary {
  pipeline: string;
  status: string;
  latency_ms: number;
  error: string | null;
  finished_at: string | null;
}
interface WorkerState {
  worker: string;
  desired: boolean;
  waiting: number;
  delayed: number;
  active: number;
  failed: number;
}
function RunbookLink({ href, name }: { href: string; name: string }) {
    return <UiRunbookLink href={href} name={name} />;
}
export function SystemHealthClient({
  heartbeats,
  alerts,
  healthScore,
  currentTime = 0,
  canaries,
  capabilities,
  killSwitchEnabled,
  workers,
}: {
  heartbeats: Heartbeat[];
  alerts: Alert[];
  healthScore: number;
  currentTime?: number;
  canaries: Canary[];
  capabilities: IntegrationCapability[];
  killSwitchEnabled: boolean;
  workers: WorkerState[];
}) {
  const [confirming, setConfirming] = useState(false),
    [stopped, setStopped] = useState(killSwitchEnabled),
    [message, setMessage] = useState("");
  const stale = heartbeats.filter(
      (item) => currentTime - new Date(item.last_beat_at).getTime() > 90_000,
    ).length,
    missing = workers.filter(
      (worker) =>
        worker.desired &&
        !heartbeats.some(
          (heartbeat) =>
            heartbeat.worker === worker.worker &&
            currentTime - new Date(heartbeat.last_beat_at).getTime() < 90_000,
        ),
    ).length,
    critical = alerts.filter((item) => item.severity === "critical").length,
    state =
      critical || stale || missing
        ? "Crítico"
        : alerts.length
          ? "Atenção"
          : "OK";
  async function toggleKillSwitch() {
    setMessage("");
    const response = await fetch(appPath("/api/kill-switch"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !stopped }),
    });
    if (response.ok) {
      setStopped(!stopped);
      setMessage(
        stopped ? "Sistema reativado." : "Kill-switch global ativado.",
      );
    } else throw new Error("Não foi possível alterar o kill-switch.");
    setConfirming(false);
  }
  return (
    <main className="page">
      <PageHeader
        title="Saúde do sistema"
        subtitle="Heartbeats, backlog, canários, integrações e incidentes"
        actions={
          <>
            <button
              className={stopped ? "danger active" : "danger"}
              onClick={() => setConfirming(true)}
            >
              {stopped ? "Reativar sistema" : "Ativar kill-switch"}
            </button>
            {confirming && (
              <ConfirmDestructiveDialog
                onConfirm={toggleKillSwitch}
              />
            )}
          </>
        }
      />
      <p role="status">{message}</p>
      <section className="health-summary card">
        <HealthDial value={healthScore} state={state} />
        <div>
          <h2>{state}</h2>
          <p>
            {critical} críticos · {stale} atrasados · {missing} habilitados sem heartbeat · {alerts.length} alertas
          </p>
          <RunbookLink
            href="/docs/runbooks/system-health"
            name="Runbook de saúde"
          />
        </div>
        <StatusBadge
          status={stopped ? "Sistema pausado" : "Execução liberada"}
        />
      </section>
      <KpiRow>
        <KpiCard label="Workers ativos" value={workers.filter((worker) => worker.desired).length - missing} />
        <KpiCard
          label="Backlog real"
          value={workers.reduce((sum, item) => sum + item.waiting + item.delayed + item.active, 0)}
        />
        <KpiCard
          label="Falhas na janela"
          value={heartbeats.reduce(
            (sum, item) => sum + item.jobs_failed_window,
            0,
          )}
        />
        <KpiCard label="Alertas críticos" value={critical} />
      </KpiRow>
      <section className="card" style={{ marginTop: "var(--space-6)", marginBottom: "var(--space-6)" }}>
        <h2>Falhas operacionais recentes</h2>
        {alerts.length ? <ul>{alerts.slice(0, 10).map(alert => <li key={alert.id}><StatusBadge status={alert.severity} /> {alert.kind} · {new Date(alert.created_at).toLocaleString('pt-BR')}</li>)}</ul> : <p>Nenhuma falha persistida nas fontes de alerta.</p>}
      </section>
      <div className="feature-grid">
        <section className="card panel">
          <h2>Estado desejado e consumidores</h2>
          <div className="health-table" role="table">
            {workers.map((worker) => {
              const heartbeat = heartbeats.find((item) => item.worker === worker.worker)
              const connected = Boolean(heartbeat && currentTime - new Date(heartbeat.last_beat_at).getTime() < 90_000)
              return (
                <div role="row" key={`desired:${worker.worker}`}>
                  <strong>{worker.worker}</strong>
                  <StatusBadge status={worker.desired ? (connected ? "running" : "missing") : "disabled"} />
                  <span>fila {worker.waiting + worker.delayed + worker.active}</span>
                  <span>DLQ/falhas {worker.failed}</span>
                </div>
              )
            })}
          </div>
        </section>
        <section className="card panel">
          <h2>Heartbeats por worker</h2>
          <div className="health-table" role="table">
            {heartbeats.map((item) => (
              <div role="row" key={`${item.worker}:${item.instance_id}`}>
                <strong>{item.worker}</strong>
                <LiveBadge
                  connected={
                    currentTime - new Date(item.last_beat_at).getTime() < 90_000
                  }
                  lastUpdate={new Date(item.last_beat_at).toLocaleTimeString(
                    "pt-BR",
                  )}
                />
                <span>{item.state}</span>
                <span>
                  p95 {Math.round(Number(item.p95_latency_ms ?? 0))} ms
                </span>
                <span>backlog {item.backlog_seen}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Capacidade dos workers</h2>
          {heartbeats.map((item) => (
            <div key={`quota:${item.worker}:${item.instance_id}`}>
              <label>{item.worker}</label>
              <QuotaMeter
                used={item.backlog_seen}
                limit={Math.max(item.backlog_seen + item.jobs_done_window, 1)}
              />
            </div>
          ))}
        </section>
      </div>
      <section>
        <h2>Canários</h2>
        <div className="canary-grid">
          {canaries.map((item) => (
            <article className="card" key={item.pipeline}>
              <StatusBadge status={item.status} />
              <strong>{item.pipeline}</strong>
              <span>{item.latency_ms} ms</span>
              <small>
                {item.finished_at
                  ? new Date(item.finished_at).toLocaleString("pt-BR")
                  : "Sem execução concluída"}
              </small>
              {item.error && <p>{item.error}</p>}
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2>Integrações</h2>
        <div className="integration-grid">
          {capabilities.map((item) => (
            <IntegrationState
              key={item.id}
              name={item.name}
              status={item.status}
              detail={item.detail}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
