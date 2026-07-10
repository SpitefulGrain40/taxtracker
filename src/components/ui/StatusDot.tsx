type Status = 'green' | 'yellow' | 'gray'

const colours: Record<Status, string> = {
  green: 'bg-green',
  yellow: 'bg-yellow',
  gray: 'bg-text-3',
}

export function StatusDot({ status }: { status: Status }) {
  return <span className={`inline-block w-[7px] h-[7px] rounded-full ${colours[status]}`} />
}
