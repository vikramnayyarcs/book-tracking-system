import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "react-aria-components";
import { useSession } from "../auth/session.tsx";

const focus =
  "outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent";

export function AccountMenu() {
  const session = useSession();
  const user = session.user;
  const initial = (user?.label.trim()[0] ?? "?").toUpperCase();

  return (
    <MenuTrigger>
      <Button
        aria-label="Account menu"
        className={`grid size-11 place-items-center overflow-hidden rounded-full border border-border-strong bg-accent-subtle font-mono text-base text-accent-subtle-ink ${focus}`}
      >
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="size-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span aria-hidden="true">{initial}</span>
        )}
      </Button>
      <Popover
        placement="bottom end"
        className="min-w-nav rounded-md border border-border bg-surface-raised p-xs text-ink"
      >
        <Menu aria-label="Account" className="outline-none">
          <MenuItem
            id="sign-out"
            onAction={() => void session.signOut()}
            className={`flex min-h-11 cursor-default items-center rounded-sm px-md text-base data-[focused]:bg-accent-subtle data-[focused]:text-accent-subtle-ink ${focus}`}
          >
            Sign out
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
