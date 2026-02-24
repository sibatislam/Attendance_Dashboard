import { useTeamsLicense } from '../hooks/useTeamsLicense'

export default function TeamsLicenseCards() {
  const [license] = useTeamsLicense()
  const costPerLicense = license.perLicenseCost != null && !Number.isNaN(license.perLicenseCost) ? Number(license.perLicenseCost) : null

  const cards = [
    {
      label: 'Total Teams License',
      value: license.totalTeams,
      bg: 'bg-gradient-to-br from-blue-500 to-blue-700',
      border: 'border-blue-600',
      text: 'text-white',
      labelText: 'text-blue-100',
    },
    {
      label: 'Total assigned license',
      value: license.totalAssigned,
      bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
      border: 'border-emerald-600',
      text: 'text-white',
      labelText: 'text-emerald-100',
    },
    {
      label: 'Free license',
      value: license.free,
      bg: 'bg-gradient-to-br from-amber-500 to-amber-700',
      border: 'border-amber-600',
      text: 'text-white',
      labelText: 'text-amber-100',
    },
    {
      label: 'CIPLC License',
      value: license.ciplcLicense ?? 0,
      bg: 'bg-gradient-to-br from-violet-500 to-violet-700',
      border: 'border-violet-600',
      text: 'text-white',
      labelText: 'text-violet-100',
    },
    {
      label: 'CBL License',
      value: license.cblLicense ?? 0,
      bg: 'bg-gradient-to-br from-rose-500 to-rose-700',
      border: 'border-rose-600',
      text: 'text-white',
      labelText: 'text-rose-100',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c) => {
        const totalCost = costPerLicense != null && typeof c.value === 'number' ? c.value * costPerLicense : null
        return (
          <div
            key={c.label}
            className={`card p-4 ${c.bg} border-2 ${c.border} shadow-lg`}
          >
            <p className={`text-sm font-semibold ${c.labelText}`}>{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.text}`}>
              {typeof c.value === 'number' ? c.value.toLocaleString() : c.value}
            </p>
            {totalCost != null && (
              <p className={`text-xs mt-1.5 opacity-95 ${c.labelText}`}>
                Total cost: {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT/year
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
