import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as ToastPrimitive from '@radix-ui/react-toast';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { X } from 'lucide-react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

// ─── Button ───────────────────────────────────────────────────────────────────

export function Button({
  className,
  variant = 'default',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md';
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' && 'h-7 gap-1.5 px-2.5 text-xs',
        size === 'md' && 'h-9 gap-2 px-3.5 text-sm',
        variant === 'default' &&
          'bg-accent text-accent-foreground shadow-sm hover:opacity-90',
        variant === 'secondary' &&
          'border border-border bg-surface text-foreground hover:bg-surface-elevated hover:border-accent/30',
        variant === 'ghost' &&
          'text-muted-foreground hover:bg-surface hover:text-foreground',
        variant === 'danger' &&
          'border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20',
        variant === 'outline' &&
          'border border-border bg-transparent text-foreground hover:bg-surface',
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground',
        'transition-all duration-150 hover:bg-surface hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

// ─── Form controls ────────────────────────────────────────────────────────────

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none',
        'placeholder:text-muted-foreground transition-colors',
        'focus:border-accent/60 focus:ring-2 focus:ring-accent/10',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-9 w-full cursor-pointer rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none',
        'transition-colors focus:border-accent/60',
        '[&>option]:bg-card',
        className,
      )}
    />
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className={cn('inline-flex cursor-pointer select-none items-center gap-2', className)}>
      <input
        type="checkbox"
        {...props}
        className="h-4 w-4 rounded border-border bg-surface accent-accent"
      />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </label>
  );
}

// ─── Switch ───────────────────────────────────────────────────────────────────

export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2">
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent',
          'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          checked ? 'bg-accent' : 'bg-border',
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm',
            'will-change-transform transition-transform duration-200',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </SwitchPrimitive.Root>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </label>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

type BadgeTone = 'default' | 'ok' | 'conflict' | 'invalid' | 'unchanged' | 'accent';

export function Badge({
  className,
  tone = 'default',
  dot,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[10px] font-semibold uppercase tracking-wide',
        tone === 'default' && 'border-border bg-surface text-muted-foreground',
        tone === 'ok' && 'border-ok/20 bg-ok/10 text-ok',
        tone === 'conflict' && 'border-conflict/20 bg-conflict/10 text-conflict',
        tone === 'invalid' && 'border-invalid/20 bg-invalid/10 text-invalid',
        tone === 'unchanged' && 'border-unchanged/20 bg-unchanged/10 text-unchanged',
        tone === 'accent' && 'border-accent/20 bg-accent/10 text-accent',
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            tone === 'default' && 'bg-muted-foreground',
            tone === 'ok' && 'bg-ok',
            tone === 'conflict' && 'bg-conflict',
            tone === 'invalid' && 'bg-invalid',
            tone === 'unchanged' && 'bg-unchanged',
            tone === 'accent' && 'bg-accent',
          )}
        />
      )}
      {props.children}
    </span>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function Panel({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      {...props}
      className={cn('flex flex-col overflow-hidden rounded-xl border border-border bg-card', className)}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  detail,
  actions,
  className,
}: {
  title: string;
  detail?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border px-4 py-3',
        'sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground',
        className,
      )}
    >
      {message}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={500}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className="z-50 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-lg"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-foreground" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// ─── Dropdown Menu ────────────────────────────────────────────────────────────

export const DropdownMenuRoot = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: DropdownMenuPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-44 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-xl',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: DropdownMenuPrimitive.DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none',
        'transition-colors hover:bg-surface focus:bg-surface',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <DropdownMenuPrimitive.Separator className={cn('my-1 h-px bg-border', className)} />;
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl outline-none">
          <div className="flex items-start justify-between border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-foreground">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton>
                <X className="h-4 w-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="max-h-[min(80vh,720px)] overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l border-border bg-card shadow-2xl outline-none">
          <div className="flex items-start justify-between border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-foreground">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton>
                <X className="h-4 w-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="h-[calc(100vh-73px)] overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export const ToastProvider = ToastPrimitive.Provider;

export function ToastViewport({ className }: { className?: string }) {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        'fixed right-4 top-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] max-w-full flex-col gap-2 outline-none',
        className,
      )}
    />
  );
}

export function Toast({
  className,
  tone = 'default',
  ...props
}: ToastPrimitive.ToastProps & { tone?: 'default' | 'ok' | 'accent' | 'conflict' }) {
  return (
    <ToastPrimitive.Root
      className={cn(
        'group rounded-xl border bg-card p-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/95',
        'transition-all duration-200',
        'data-[state=closed]:pointer-events-none data-[state=closed]:-translate-y-2 data-[state=closed]:opacity-0',
        'data-[state=open]:translate-y-0 data-[state=open]:opacity-100',
        'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform',
        'data-[swipe=end]:translate-x-[calc(100%+1rem)] data-[swipe=end]:opacity-0',
        tone === 'default' && 'border-border',
        tone === 'ok' && 'border-ok/30 bg-ok/10',
        tone === 'accent' && 'border-accent/30 bg-accent/10',
        tone === 'conflict' && 'border-conflict/30 bg-conflict/10',
        className,
      )}
      {...props}
    />
  );
}

export function ToastTitle({ className, ...props }: ToastPrimitive.ToastTitleProps) {
  return <ToastPrimitive.Title className={cn('text-sm font-semibold text-foreground', className)} {...props} />;
}

export function ToastDescription({
  className,
  ...props
}: ToastPrimitive.ToastDescriptionProps) {
  return <ToastPrimitive.Description className={cn('mt-1 text-xs text-muted-foreground', className)} {...props} />;
}

export function ToastAction({
  className,
  ...props
}: ToastPrimitive.ToastActionProps) {
  return (
    <ToastPrimitive.Action
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-elevated',
        className,
      )}
      {...props}
    />
  );
}

export function ToastClose({ className, ...props }: ToastPrimitive.ToastCloseProps) {
  return (
    <ToastPrimitive.Close
      className={cn(
        'absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground',
        className,
      )}
      {...props}
    >
      <X className="h-4 w-4" />
    </ToastPrimitive.Close>
  );
}

// ─── Section title (legacy compat) ───────────────────────────────────────────

export function SectionTitle({
  title,
  detail,
  actions,
}: {
  title: string;
  detail?: string;
  actions?: ReactNode;
}) {
  return <PanelHeader title={title} detail={detail} actions={actions} />;
}
