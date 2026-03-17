<script lang="ts">
  import SearchBar from './SearchBar.svelte'
  import ConversationItem from './ConversationItem.svelte'
  import { displayConversations, conversations } from '../stores/conversations.svelte'
  import { t } from '../stores/i18n.svelte'

  const isEmpty = $derived(displayConversations.current.length === 0)
</script>

<div class="conversation-list">
  <SearchBar />

  {#if conversations.loading && conversations.raw.length === 0}
    <div class="conversation-list__status">
      <div class="conversation-list__spinner"></div>
      <span>{t('conversations.loading')}</span>
    </div>
  {:else if isEmpty}
    <div class="conversation-list__status">
      {#if conversations.searchQuery}
        <span>{t('conversations.noMatch')}</span>
      {:else}
        <span>{t('conversations.empty')}</span>
      {/if}
    </div>
  {:else}
    <div class="conversation-list__items">
      {#each displayConversations.current as conv (conv.threadId)}
        <ConversationItem conversation={conv} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .conversation-list {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .conversation-list__items {
    flex: 1;
    overflow-y: auto;
  }

  .conversation-list__status {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    padding: var(--space-4);
  }

  .conversation-list__spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--accent-primary);
    border-radius: var(--radius-full);
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
