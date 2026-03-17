<script lang="ts">
  import Avatar from './Avatar.svelte'
  import { formatConversationTime } from '../lib/format'
  import { conversations, selectConversation } from '../stores/conversations.svelte'

  interface Props {
    conversation: DisplayConversation
  }

  const { conversation }: Props = $props()

  const isSelected = $derived(conversations.selectedThreadId === conversation.threadId)
  const isUnread = $derived(conversation.unreadCount > 0)
  const timeStr = $derived(formatConversationTime(conversation.date))
</script>

<button
  class="conversation-item"
  class:conversation-item--selected={isSelected}
  class:conversation-item--unread={isUnread}
  onclick={() => selectConversation(conversation.threadId)}
>
  <Avatar initials={conversation.avatarInitials} color={conversation.avatarColor} photo={conversation.avatarPhoto} />
  <div class="conversation-item__content">
    <div class="conversation-item__header">
      <span class="conversation-item__name">{conversation.displayName}</span>
      <span class="conversation-item__time">{timeStr}</span>
    </div>
    <div class="conversation-item__footer">
      <span class="conversation-item__snippet">{conversation.snippet}</span>
      {#if conversation.unreadCount > 0}
        <span class="conversation-item__badge">{conversation.unreadCount}</span>
      {/if}
    </div>
  </div>
</button>

<style>
  .conversation-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    transition: background-color 0.15s;
    font-family: var(--font-family);
  }

  .conversation-item:hover {
    background-color: var(--bg-hover);
  }

  .conversation-item--selected {
    background-color: var(--bg-selected);
  }

  .conversation-item--selected:hover {
    background-color: var(--bg-selected);
  }

  .conversation-item__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .conversation-item__header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
  }

  .conversation-item__name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-normal);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conversation-item--unread .conversation-item__name {
    font-weight: var(--font-weight-semibold);
  }

  .conversation-item__time {
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .conversation-item--unread .conversation-item__time {
    color: var(--accent-primary);
  }

  .conversation-item__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .conversation-item__snippet {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conversation-item--unread .conversation-item__snippet {
    color: var(--text-primary);
  }

  .conversation-item__badge {
    flex-shrink: 0;
    min-width: 18px;
    height: 18px;
    padding: 0 var(--space-1);
    background-color: var(--accent-primary);
    color: #fff;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
