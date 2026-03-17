<script lang="ts">
  import { contacts } from '../stores/contacts.svelte'
  import { formatPhone } from '../lib/phone'
  import { t } from '../stores/i18n.svelte'

  interface Props {
    onSelect: (address: string) => void
  }

  let { onSelect }: Props = $props()

  let query = $state('')
  let inputEl: HTMLInputElement | undefined = $state()
  let highlightIndex = $state(-1)

  interface AutocompleteResult {
    name: string
    phone: string
    displayPhone: string
  }

  const results = $derived.by(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return [] as AutocompleteResult[]

    const matches: AutocompleteResult[] = []
    for (const contact of contacts.list) {
      if (!contact.name.toLowerCase().includes(q)) continue
      const phones = contact.phone_numbers.split(';').filter(Boolean)
      for (const phone of phones) {
        matches.push({
          name: contact.name,
          phone,
          displayPhone: formatPhone(phone),
        })
        if (matches.length >= 8) return matches
      }
    }
    return matches
  })

  const showDropdown = $derived(results.length > 0)

  function selectResult(result: AutocompleteResult): void {
    query = ''
    highlightIndex = -1
    onSelect(result.phone)
  }

  function submitRaw(): void {
    const trimmed = query.trim()
    if (trimmed.length === 0) return
    // Check if highlighted, select that
    if (highlightIndex >= 0 && highlightIndex < results.length) {
      selectResult(results[highlightIndex]!)
      return
    }
    // Accept raw input if it has 7+ digits
    const digits = trimmed.replace(/[^\d]/g, '')
    if (digits.length >= 7) {
      const raw = trimmed
      query = ''
      highlightIndex = -1
      onSelect(raw)
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length > 0) {
        highlightIndex = (highlightIndex + 1) % results.length
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length > 0) {
        highlightIndex = highlightIndex <= 0 ? results.length - 1 : highlightIndex - 1
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submitRaw()
    } else if (e.key === 'Escape') {
      query = ''
      highlightIndex = -1
    }
  }

  // Reset highlight when results change
  $effect(() => {
    results.length
    highlightIndex = -1
  })

  // Auto-focus on mount
  $effect(() => {
    if (inputEl) inputEl.focus()
  })
</script>

<div class="autocomplete">
  <input
    bind:this={inputEl}
    class="autocomplete__input"
    type="text"
    placeholder={t('contacts.placeholder')}
    bind:value={query}
    onkeydown={handleKeydown}
  />
  {#if showDropdown}
    <div class="autocomplete__dropdown">
      {#each results as result, i}
        <button
          class="autocomplete__item"
          class:autocomplete__item--highlighted={i === highlightIndex}
          onmousedown={(e: MouseEvent) => { e.preventDefault(); selectResult(result) }}
          onmouseenter={() => { highlightIndex = i }}
        >
          <span class="autocomplete__name">{result.name}</span>
          <span class="autocomplete__phone">{result.displayPhone}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .autocomplete {
    position: relative;
    flex: 1;
  }

  .autocomplete__input {
    width: 100%;
    background-color: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    outline: none;
    transition: border-color 0.15s;
  }

  .autocomplete__input::placeholder {
    color: var(--text-muted);
  }

  .autocomplete__input:focus {
    border-color: var(--accent-primary);
  }

  .autocomplete__dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 100;
    margin-top: var(--space-1);
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    max-height: 240px;
    overflow-y: auto;
  }

  .autocomplete__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: none;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    cursor: pointer;
    text-align: left;
  }

  .autocomplete__item:hover,
  .autocomplete__item--highlighted {
    background-color: var(--bg-hover);
  }

  .autocomplete__name {
    font-weight: var(--font-weight-medium);
  }

  .autocomplete__phone {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    margin-left: var(--space-2);
    flex-shrink: 0;
  }
</style>
