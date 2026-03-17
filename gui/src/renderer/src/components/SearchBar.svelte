<script lang="ts">
  import {
    conversations,
    setSearchQuery,
    toggleSpamFilter,
    toggleUnreadFilter,
  } from '../stores/conversations.svelte'
  import { t } from '../stores/i18n.svelte'

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement
    setSearchQuery(target.value)
  }

  function clearSearch(): void {
    setSearchQuery('')
  }

  const hasQuery = $derived(conversations.searchQuery.length > 0)
</script>

<div class="search-bar">
  <div class="search-bar__input-wrapper">
    <svg class="search-bar__icon" viewBox="0 0 24 24" width="16" height="16">
      <path
        fill="currentColor"
        d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
      />
    </svg>
    <input
      class="search-bar__input"
      type="text"
      placeholder={t('search.placeholder')}
      value={conversations.searchQuery}
      oninput={handleInput}
    />
    {#if hasQuery}
      <button class="search-bar__clear" onclick={clearSearch} title={t('search.clear')}>
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path
            fill="currentColor"
            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
          />
        </svg>
      </button>
    {/if}
  </div>
  <button
    class="search-bar__filter"
    class:search-bar__filter--active={conversations.showUnreadOnly}
    onclick={toggleUnreadFilter}
    title={conversations.showUnreadOnly ? t('search.showAll') : t('search.showUnread')}
  >
    <svg viewBox="0 0 24 24" width="16" height="16">
      <circle cx="12" cy="12" r="6" fill="currentColor"/>
    </svg>
  </button>
  <button
    class="search-bar__filter"
    class:search-bar__filter--active={conversations.showSpam}
    onclick={toggleSpamFilter}
    title={conversations.showSpam ? t('search.filterSpam') : t('search.showAll')}
  >
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path
        fill="currentColor"
        d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"
      />
    </svg>
  </button>
</div>

<style>
  .search-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .search-bar__input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background-color: var(--bg-surface);
    border-radius: var(--radius-md);
    padding: var(--space-1) var(--space-2);
  }

  .search-bar__icon {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .search-bar__input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-family: var(--font-family);
  }

  .search-bar__input::placeholder {
    color: var(--text-muted);
  }

  .search-bar__clear {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
  }

  .search-bar__clear:hover {
    color: var(--text-secondary);
  }

  .search-bar__filter {
    flex-shrink: 0;
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    transition: background-color 0.15s, color 0.15s;
  }

  .search-bar__filter:hover {
    background-color: var(--bg-hover);
    color: var(--text-secondary);
  }

  .search-bar__filter--active {
    background-color: var(--accent-primary);
    border-color: var(--accent-primary);
    color: #fff;
  }

  .search-bar__filter--active:hover {
    background-color: #4a7ddf;
    color: #fff;
  }
</style>
