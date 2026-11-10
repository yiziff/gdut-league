import { Link } from 'react-router';
import { SPORT_MAP } from '../../sports';
import { usePlayerSession } from './session';

/** 名下有多个名单条目时切换当前查看的那支队伍。 */
export function AccountSwitcher() {
  const { accounts, profile, select } = usePlayerSession();
  if (accounts.length < 2 || !profile) return null;
  return (
    <div className="surface mb-4 flex flex-wrap gap-1 p-1 text-sm">
      {accounts.map((account) => {
        const active = account.player.id === profile.player.id;
        return (
          <button
            key={account.player.id}
            type="button"
            onClick={() => select(account.player.id)}
            className={`rounded-md px-3 py-1.5 text-left ${active ? 'bg-gdut-700 font-semibold text-white' : 'text-slate-500 hover:text-gdut-800'}`}
          >
            {account.team.name}
            <span className={`ml-1.5 text-xs ${active ? 'text-white/75' : 'text-slate-400'}`}>
              {SPORT_MAP[account.league.sport].name} · #{account.player.number}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 没登录让去登录，登录了但没认领让去认领。 */
export function NeedProfile({ action }: { action: string }) {
  const { user } = usePlayerSession();
  return (
    <div className="empty-state mx-auto max-w-lg">
      {user ? `认领你的名单后${action}。` : `登录后${action}。`}{' '}
      <Link to={user ? '/player/claim' : '/player/login'} className="font-medium text-gdut-700">
        {user ? '去认领' : '去登录'}
      </Link>
    </div>
  );
}
