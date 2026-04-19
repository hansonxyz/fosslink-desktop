<script lang="ts">
  import Avatar from './Avatar.svelte'
  import { findContactByPhone } from '../stores/contacts.svelte'
  import { getInitials, getAvatarColor } from '../lib/avatar'
  import { formatPhone } from '../lib/phone'

  interface Props {
    addresses: string[]
    threadId: number
    onClose: () => void
    onViewMedia: () => void
    onMemberClick: (address: string) => void
  }

  let { addresses, onClose, onViewMedia, onMemberClick }: Props = $props()

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose()
  }

  interface Member {
    address: string
    name: string
    initials: string
    color: string
    photo: string | null
  }

  const members = $derived(addresses.map((addr): Member => {
    const contact = findContactByPhone(addr)
    return {
      address: addr,
      name: contact ? contact.name : formatPhone(addr),
      initials: contact ? getInitials(contact.name) : '#',
      color: getAvatarColor(contact?.name ?? addr),
      photo: contact?.photo_path ? `xyzattachment://contact-photo/${contact.uid}` : null,
    }
  }))
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={handleBackdropClick}>
  <div class="dialog">
    <button class="dialog__close" onclick={onClose} title="Close">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>

    <div class="dialog__content">
      <h2 class="dialog__title">Group · {addresses.length} members</h2>

      <div class="dialog__divider"></div>

      <div class="dialog__members">
        {#each members as member (member.address)}
          <button class="member-row" onclick={() => onMemberClick(member.address)}>
            <Avatar initials={member.initials} color={member.color} size={36} photo={member.photo} />
            <span class="member-row__name">{member.name}</span>
            <svg class="member-row__chevron" viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </button>
        {/each}
      </div>

      <div class="dialog__divider"></div>

      <button class="dialog__media-btn" onclick={onViewMedia}>
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
        View Media
      </button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dialog {
    position: relative;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-8) var(--space-6) var(--space-6);
    max-width: 400px;
    width: 90vw;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
    max-height: 85vh;
    overflow-y: auto;
  }

  .dialog__close {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    transition: color 0.15s, background-color 0.15s;
  }

  .dialog__close:hover {
    color: var(--text-secondary);
    background-color: var(--bg-hover);
  }

  .dialog__content {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .dialog__title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin: 0;
    text-align: center;
  }

  .dialog__divider {
    height: 1px;
    background-color: var(--border);
    margin: var(--space-4) 0;
    width: 100%;
  }

  .dialog__members {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .member-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-2);
    background: none;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    color: var(--text-primary);
    font-family: var(--font-family);
    transition: background-color 0.15s;
  }

  .member-row:hover {
    background-color: var(--bg-hover);
  }

  .member-row__name {
    flex: 1;
    font-size: var(--font-size-base);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .member-row__chevron {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .dialog__media-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-3);
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-family: var(--font-family);
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
  }

  .dialog__media-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }
</style>
