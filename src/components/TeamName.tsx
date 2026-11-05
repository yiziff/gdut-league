import { Link } from 'react-router';
import { useData } from '../data/store';

interface Props {
  teamId: string | null;
  placeholder?: string;
  full?: boolean;
  bold?: boolean;
  /** 包在另一条链接里时不要再套一层链接 */
  plain?: boolean;
}

export default function TeamName({ teamId, placeholder = '待定', full = false, bold = false, plain = false }: Props) {
  const { teamMap } = useData();
  const team = teamId ? teamMap[teamId] : undefined;
  if (!team) return <span className="truncate text-sm text-slate-400 italic">{placeholder}</span>;
  const className = `inline-flex min-w-0 items-center gap-1.5 ${plain ? '' : 'hover:text-gdut-600'} ${bold ? 'font-bold' : ''}`;
  const body = (
    <>
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: team.color }} />
      <span className="truncate">{full ? team.name : team.short}</span>
    </>
  );
  if (plain) return <span className={className}>{body}</span>;
  return (
    <Link to={`/teams/${team.id}`} className={className}>
      {body}
    </Link>
  );
}
