#!/usr/bin/env bash
set -euo pipefail

# Organic operation rollout script
# Executes the gradual worker activation plan from PLANO-OPERACAO-ORGANICA.md
# Phase 1: news-radar only (48h observation)
# Phase 2: competitive-intel
# Phase 3: threads-publisher
# Phase 4: publisher (Instagram)

DB_URL="${DATABASE_URL:?DATABASE_URL is required}"
PHASE="${1:-status}"

run_sql() {
  psql "$DB_URL" -t -A -c "$1"
}

case "$PHASE" in
  status)
    echo "=== Organic Workers Status ==="
    run_sql "SELECT worker_name, enabled, last_execution_at, items_processed, last_error FROM worker_settings WHERE worker_name IN ('news-radar', 'competitive-intel', 'publisher', 'threads-publisher') ORDER BY worker_name"
    echo ""
    echo "=== Recent Radar Findings (last 48h) ==="
    run_sql "SELECT COUNT(*) AS findings, ROUND(AVG(relevance_score)::numeric, 2) AS avg_relevance FROM radar_findings WHERE created_at >= now() - interval '48 hours'"
    echo ""
    echo "=== Pending Suggestions ==="
    run_sql "SELECT curation_status, COUNT(*) FROM content_suggestions GROUP BY curation_status"
    ;;

  1|phase1)
    echo "=== Phase 1: Activating news-radar ==="
    run_sql "UPDATE worker_settings SET enabled = true WHERE worker_name = 'news-radar'"
    echo "news-radar enabled. Monitor for 48h before proceeding to phase 2."
    echo "Check: GET /api/admin/organic-metrics"
    ;;

  2|phase2)
    echo "=== Phase 2: Activating competitive-intel ==="
    # Verify phase 1 ran successfully
    RADAR_COUNT=$(run_sql "SELECT COUNT(*) FROM radar_findings WHERE created_at >= now() - interval '48 hours'")
    if [ "$RADAR_COUNT" -eq 0 ]; then
      echo "WARNING: No radar findings in the last 48h. Phase 1 may not be working correctly."
      read -p "Continue anyway? (y/N) " -r
      [[ $REPLY =~ ^[Yy]$ ]] || exit 1
    fi
    run_sql "UPDATE worker_settings SET enabled = true WHERE worker_name = 'competitive-intel'"
    echo "competitive-intel enabled. First run: Monday 6:00 UTC."
    ;;

  3|phase3)
    echo "=== Phase 3: Activating threads-publisher ==="
    if [ -z "${THREADS_ACCESS_TOKEN:-}" ]; then
      echo "ERROR: THREADS_ACCESS_TOKEN is not set. Cannot activate Threads publisher."
      exit 1
    fi
    run_sql "UPDATE worker_settings SET enabled = true WHERE worker_name = 'threads-publisher'"
    echo "threads-publisher enabled. Will publish approved Threads content every minute."
    ;;

  4|phase4)
    echo "=== Phase 4: Activating publisher (Instagram) ==="
    if [ -z "${META_ACCESS_TOKEN:-}" ]; then
      echo "WARNING: META_ACCESS_TOKEN not set. Publisher will use fallback package mode."
    fi
    run_sql "UPDATE worker_settings SET enabled = true WHERE worker_name = 'publisher'"
    echo "publisher enabled. Instagram publications will process every minute."
    ;;

  migrations)
    echo "=== Running migrations through the canonical runner ==="
    command -v pnpm >/dev/null 2>&1 || { echo "ERROR: pnpm is required for the canonical migration runner." >&2; exit 1; }
    test -f packages/db/src/migrate.ts || { echo "ERROR: run from the platform repository root." >&2; exit 1; }
    backup_dir="${BACKUP_DIR:-./backups}"
    mkdir -p "$backup_dir"
    chmod 700 "$backup_dir"
    backup_file="$backup_dir/pre-organic-backup-$(date +%Y%m%d_%H%M%S).dump"
    echo "Creating backup: $backup_file"
    pg_dump "$DB_URL" --format=custom --file="$backup_file"
    test -s "$backup_file"
    echo "Backup complete."

    pnpm --filter @plataforma/db migrate
    latest=$(run_sql "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")
    expected=$(find packages/db/migrations -maxdepth 1 -type f -name '*.up.sql' -printf '%f\n' | sort | tail -n 1 | sed 's/\.up\.sql$//')
    test -n "$expected"
    test "${latest//[[:space:]]/}" = "$expected"
    echo "Canonical migrations complete: $expected"
    ;;

  verify)
    echo "=== Post-migration verification ==="
    echo "Tables:"
    run_sql "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('radar_findings', 'competitor_insights', 'content_suggestions', 'worker_settings', 'content_pillars', 'format_playbook', 'editorial_rules', 'news_sources', 'news_items', 'organic_budget_reservations') ORDER BY table_name"
    echo ""
    echo "Triggers:"
    run_sql "SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_name LIKE '%immutability%'"
    echo ""
    echo "Seed data:"
    run_sql "SELECT 'pillars' AS entity, COUNT(*) FROM content_pillars UNION ALL SELECT 'formats', COUNT(*) FROM format_playbook UNION ALL SELECT 'rules', COUNT(*) FROM editorial_rules UNION ALL SELECT 'competitors', COUNT(*) FROM competitors WHERE source = 'doctrine_seed' UNION ALL SELECT 'vocabulary', COUNT(*) FROM audience_vocabulary UNION ALL SELECT 'hooks', COUNT(*) FROM validated_hooks UNION ALL SELECT 'news_sources', COUNT(*) FROM news_sources UNION ALL SELECT 'worker_settings', COUNT(*) FROM worker_settings"
    ;;

  killswitch)
    echo "=== Kill switch: disabling all publishers ==="
    run_sql "UPDATE worker_settings SET enabled = false WHERE worker_name IN ('publisher', 'threads-publisher')"
    echo "All publishers disabled."
    ;;

  *)
    echo "Usage: $0 {status|phase1|phase2|phase3|phase4|migrations|verify|killswitch}"
    echo ""
    echo "Phases:"
    echo "  phase1     - Enable news-radar (observe 48h)"
    echo "  phase2     - Enable competitive-intel"
    echo "  phase3     - Enable threads-publisher"
    echo "  phase4     - Enable publisher (Instagram)"
    echo ""
    echo "Operations:"
    echo "  status     - Show current worker status"
    echo "  migrations - Backup and run the canonical @plataforma/db migration runner"
    echo "  verify     - Verify post-migration state"
    echo "  killswitch - Disable all publishers immediately"
    exit 1
    ;;
esac
