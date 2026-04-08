type StatCardProps = {
  label: string
  value: string
  detail?: string
}

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <div className="metric-card">
      <div className="small-label">{label}</div>
      <p className="metric-value">{value}</p>
      {detail ? <p className="muted">{detail}</p> : null}
    </div>
  )
}
