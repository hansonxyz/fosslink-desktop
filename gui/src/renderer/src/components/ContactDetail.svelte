<script lang="ts">
  import Avatar from './Avatar.svelte'
  import { getInitials, getAvatarColor } from '../lib/avatar'
  import { formatPhone } from '../lib/phone'
  import { filterList, addToFilterList, removeFromFilterList } from '../stores/filter-list.svelte'

  interface Props {
    contact: ContactRow
    avatarPhoto: string | null
    /** The thread's addresses — used for filter list operations. */
    threadAddresses?: string[]
    /** Thread ID — used for media gallery. */
    threadId?: number
    onClose: () => void
    onDial?: (phoneNumber: string) => void
    onViewMedia?: () => void
    onSendMessage?: () => void
  }

  let { contact, avatarPhoto, threadAddresses, threadId, onClose, onDial, onViewMedia, onSendMessage }: Props = $props()

  const filterAddress = $derived(threadAddresses?.[0] ?? '')
  const isCurrentlyFiltered = $derived(filterAddress ? filterList.isFiltered(filterAddress) : false)

  async function toggleFilter(): Promise<void> {
    if (!filterAddress) return
    if (isCurrentlyFiltered) {
      await removeFromFilterList(filterAddress)
    } else {
      await addToFilterList(filterAddress)
    }
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  // Parse JSON fields
  const phones = $derived.by(() => {
    try {
      const parsed = JSON.parse(contact.phone_numbers) as unknown
      if (Array.isArray(parsed)) {
        return (parsed as Array<PhoneEntry | string>).map((p) =>
          typeof p === 'string' ? { number: p, type: 'other' } : p,
        )
      }
    } catch { /* ignore */ }
    return [{ number: contact.phone_numbers, type: 'other' }] as PhoneEntry[]
  })

  const emails = $derived.by(() => {
    if (!contact.emails) return [] as EmailEntry[]
    try {
      return JSON.parse(contact.emails) as EmailEntry[]
    } catch { return [] as EmailEntry[] }
  })

  const addresses = $derived.by(() => {
    if (!contact.addresses) return [] as AddressEntry[]
    try {
      return JSON.parse(contact.addresses) as AddressEntry[]
    } catch { return [] as AddressEntry[] }
  })

  const hasDetails = $derived(
    contact.organization || contact.birthday || contact.notes,
  )

  function formatType(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  function formatBirthday(bday: string): string {
    // Input: YYYY-MM-DD
    const parts = bday.split('-')
    if (parts.length !== 3) return bday
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthIdx = parseInt(parts[1]!, 10) - 1
    const month = months[monthIdx] ?? parts[1]
    const day = parseInt(parts[2]!, 10)
    return `${month} ${day}, ${parts[0]}`
  }

  function formatAccountType(accountType: string): string {
    if (accountType === 'com.google') return 'Google'
    if (accountType === 'com.android.contacts' || accountType === 'vnd.sec.contact.phone') return 'Device'
    // Strip common prefixes
    const short = accountType.replace(/^com\.(google|android|samsung|sec)\./, '')
    return short.charAt(0).toUpperCase() + short.slice(1)
  }
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
      <!-- Large avatar -->
      <div class="dialog__avatar">
        <Avatar
          initials={getInitials(contact.name)}
          color={getAvatarColor(contact.name)}
          size={80}
          photo={avatarPhoto}
        />
      </div>

      <!-- Name -->
      <h2 class="dialog__name">{contact.name}</h2>

      {#if contact.nickname}
        <p class="dialog__nickname">"{contact.nickname}"</p>
      {/if}

      <div class="dialog__divider"></div>

      <!-- Phone numbers -->
      <div class="dialog__section">
        {#each phones as phone}
          <div class="dialog__row">
            <svg class="dialog__icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
            <div class="dialog__value">
              <span class="dialog__primary">{formatPhone(phone.number)}</span>
              <span class="dialog__type">{formatType(phone.type)}</span>
            </div>
            {#if onDial}
              <button class="dialog__call-btn" onclick={() => onDial(phone.number)} title="Call {formatPhone(phone.number)}">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Emails -->
      {#if emails.length > 0}
        <div class="dialog__section">
          {#each emails as email}
            <div class="dialog__row">
              <svg class="dialog__icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              <div class="dialog__value">
                <span class="dialog__primary">{email.address}</span>
                <span class="dialog__type">{formatType(email.type)}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Addresses -->
      {#if addresses.length > 0}
        <div class="dialog__section">
          {#each addresses as addr}
            <div class="dialog__row">
              <svg class="dialog__icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <div class="dialog__value">
                <span class="dialog__primary">{addr.formatted}</span>
                <span class="dialog__type">{formatType(addr.type)}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Details: org, birthday, notes -->
      {#if hasDetails}
        <div class="dialog__divider"></div>

        {#if contact.organization}
          <div class="dialog__row">
            <svg class="dialog__icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
            </svg>
            <div class="dialog__value">
              <span class="dialog__primary">{contact.organization}</span>
            </div>
          </div>
        {/if}

        {#if contact.birthday}
          <div class="dialog__row">
            <svg class="dialog__icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99l-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12c.01-1.66-1.33-3-2.99-3z"/>
            </svg>
            <div class="dialog__value">
              <span class="dialog__primary">{formatBirthday(contact.birthday)}</span>
            </div>
          </div>
        {/if}

        {#if contact.notes}
          <div class="dialog__row">
            <svg class="dialog__icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zM13 9V3.5L18.5 9H13z"/>
            </svg>
            <div class="dialog__value">
              <span class="dialog__secondary">{contact.notes}</span>
            </div>
          </div>
        {/if}
      {/if}

      <!-- Account source -->
      {#if contact.account_type}
        <div class="dialog__divider"></div>
        <p class="dialog__account">
          {formatAccountType(contact.account_type)}{#if contact.account_name} · {contact.account_name}{/if}
        </p>
      {/if}

      <!-- Send message -->
      {#if onSendMessage}
        <div class="dialog__divider"></div>
        <button class="dialog__media-btn" onclick={onSendMessage}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
          Send Message
        </button>
      {/if}

      <!-- View media -->
      {#if onViewMedia}
        <div class="dialog__divider"></div>
        <button class="dialog__media-btn" onclick={onViewMedia}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
          View Media
        </button>
      {/if}

      <!-- Filter list toggle -->
      {#if filterAddress}
        <div class="dialog__divider"></div>
        <button class="dialog__filter-btn" class:dialog__filter-btn--active={isCurrentlyFiltered} onclick={() => void toggleFilter()}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            {#if isCurrentlyFiltered}
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
            {:else}
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            {/if}
          </svg>
          {isCurrentlyFiltered ? 'Remove from Filter List' : 'Add to Filter List'}
        </button>
      {/if}
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

  .dialog__avatar {
    margin-bottom: var(--space-3);
  }

  .dialog__name {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin: 0;
    text-align: center;
  }

  .dialog__nickname {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin: var(--space-1) 0 0;
    font-style: italic;
  }

  .dialog__divider {
    height: 1px;
    background-color: var(--border);
    margin: var(--space-4) 0;
    width: 100%;
  }

  .dialog__section {
    width: 100%;
  }

  .dialog__section + .dialog__section {
    margin-top: var(--space-2);
  }

  .dialog__row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    width: 100%;
  }

  .dialog__icon {
    flex-shrink: 0;
    color: var(--text-muted);
    margin-top: 1px;
  }

  .dialog__value {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .dialog__primary {
    font-size: var(--font-size-base);
    color: var(--text-primary);
    word-break: break-word;
  }

  .dialog__secondary {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    word-break: break-word;
  }

  .dialog__type {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .dialog__call-btn {
    flex-shrink: 0;
    margin-left: auto;
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, border-color 0.15s, background-color 0.15s;
  }

  .dialog__call-btn:hover {
    color: var(--accent-primary);
    border-color: var(--accent-primary);
    background-color: var(--bg-hover);
  }

  .dialog__account {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin: 0;
    text-align: center;
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

  .dialog__filter-btn {
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
    transition: background-color 0.15s, color 0.15s, border-color 0.15s;
  }

  .dialog__filter-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }

  .dialog__filter-btn--active {
    border-color: var(--warning);
    color: var(--warning);
  }

  .dialog__filter-btn--active:hover {
    background-color: rgba(255, 193, 7, 0.1);
  }
</style>
