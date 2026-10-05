import { chatMaintenanceApi } from './api.js';

export class MaintenanceAssistant {
  constructor({
    userId = null,
    getMachineContext = () => ({}),
  } = {}) {
    this.getMachineContext = getMachineContext;

    const token = localStorage.getItem('access_token');

    this.storageKey = userId
      ? `maintenance-assistant-chat:user:${userId}`
      : `maintenance-assistant-chat:session:${token || 'guest'}`;

    try {
      this.messages = JSON.parse(
        localStorage.getItem(this.storageKey) || '[]'
      );

      if (!Array.isArray(this.messages)) {
        this.messages = [];
      }
    } catch {
      this.messages = [];
    }

    this.pending = false;
    this.requestId = 0;
    this.requestController = null;
    this.lastSubmittedQuery = '';
    this.lastSubmittedAt = 0;

    this.editingMessageIndex = null;
    this.activeSpeakerButton = null;
    this.activeUtterance = null;
    this.lastFailedQuery = null;

    this.drawer = null;
    this.returnFocus = null;
  }

  init() {
    const trigger = document.getElementById(
      'dash-tab-btn-assistant'
    );

    if (!trigger) return;

    this.createDrawer();

    trigger.addEventListener('click', () => this.open());
  }

  saveMessages() {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(this.messages)
      );
    } catch (error) {
      console.warn('Could not save chat history:', error);
    }
  }

  createDrawer() {
    if (this.drawer) return;

    const root = document.createElement('div');
    root.id = 'maintenance-assistant-root';

    root.innerHTML = `
      <button
        type="button"
        class="maintenance-assistant-backdrop"
        data-assistant-close
        tabindex="-1"
        aria-label="Close maintenance assistant"
      ></button>

      <aside
        class="maintenance-assistant-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-assistant-title"
        aria-hidden="true"
      >
        <header class="maintenance-assistant-header">
          <div>
            <p class="maintenance-assistant-eyebrow">
              MAINTENANCE KNOWLEDGE
            </p>

            <h2 id="maintenance-assistant-title">
              AI Maintenance Assistant
            </h2>
          </div>

          <div class="maintenance-assistant-header-actions">
            <button
              type="button"
              class="maintenance-assistant-clear"
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2m-11 0 1 14h12l1-14M10 10v6M14 10v6"/>
              </svg>
            </button>

            <button
              type="button"
              class="maintenance-assistant-close"
              data-assistant-close
              aria-label="Close assistant"
              title="Close assistant"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </header>

        <div
          class="maintenance-assistant-messages"
          aria-live="polite"
          aria-relevant="additions"
        ></div>

        <p
          class="maintenance-assistant-status"
          role="status"
          hidden
        ></p>

        <form class="maintenance-assistant-form">
          <label
            class="maintenance-assistant-label"
            for="maintenance-assistant-question"
          >
            MAINTENANCE QUESTION
          </label>

          <div class="maintenance-assistant-compose">
            <textarea
              id="maintenance-assistant-question"
              rows="1"
              maxlength="4000"
              placeholder="Ask about a fault, symptom, or maintenance procedure"
              aria-describedby="maintenance-assistant-status"
            ></textarea>

            <button
              type="submit"
              class="maintenance-assistant-send"
              aria-label="Send question"
              title="Send question"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m22 2-7 20-4-9-9-4Z"/>
                <path d="M22 2 11 13"/>
              </svg>
            </button>
          </div>
        </form>
      </aside>
    `;

    document.body.appendChild(root);

    this.drawer = root.querySelector(
      '.maintenance-assistant-drawer'
    );

    this.drawer.inert = true;

    this.messagesElement = root.querySelector(
      '.maintenance-assistant-messages'
    );

    this.statusElement = root.querySelector(
      '.maintenance-assistant-status'
    );

    this.form = root.querySelector(
      '.maintenance-assistant-form'
    );

    this.input = root.querySelector(
      '#maintenance-assistant-question'
    );

    this.sendButton = root.querySelector(
      '.maintenance-assistant-send'
    );

    this.clearButton = root.querySelector(
      '.maintenance-assistant-clear'
    );

    // Enter sends; Shift + Enter adds a new line.
    this.input.addEventListener('keydown', (event) => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        this.form.requestSubmit();
      }
    });

    // Automatically resize the input as the user types.
    this.input.addEventListener('input', () => {
      this.resizeInput();
    });

    // Clear the conversation.
    this.clearButton.addEventListener('click', () => {
      this.clearConversation();
    });

    root.querySelectorAll('[data-assistant-close]').forEach(
      (button) => {
        button.addEventListener('click', () => this.close());
      }
    );

    // One submission handler only.
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      console.log('Maintenance chat form submitted');
      this.send();
    });

    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });

    this.renderMessages();
  }

  resizeInput() {
    if (!this.input) return;

    this.input.style.height = 'auto';

    this.input.style.height =
      `${Math.min(this.input.scrollHeight, 150)}px`;
  }

  clearConversation() {
    this.requestId += 1;
    this.requestController?.abort();
    this.requestController = null;
    this.pending = false;
    if (this.sendButton) this.sendButton.disabled = false;
    this.stopSpeech();

    this.messages = [];
    this.editingMessageIndex = null;

    this.saveMessages();

    this.input.value = '';
    this.input.style.height = 'auto';

    this.setStatus('', '');
    this.renderMessages();

    this.input.focus();
  }

  open() {
    if (!this.drawer) return;

    this.returnFocus = document.activeElement;

    document.body.classList.add(
      'maintenance-assistant-open'
    );

    this.drawer.inert = false;
    this.drawer.setAttribute('aria-hidden', 'false');

    this.drawer
      .closest('#maintenance-assistant-root')
      .classList.add('is-open');

    this.input.focus();
  }

  close() {
    if (!this.drawer) return;

    this.stopSpeech();

    const root = this.drawer.closest(
      '#maintenance-assistant-root'
    );

    root.classList.remove('is-open');

    this.drawer.setAttribute('aria-hidden', 'true');
    this.drawer.inert = true;

    document.body.classList.remove(
      'maintenance-assistant-open'
    );

    this.returnFocus?.focus();
  }

  async send() {
    // Prevent a second request while one is running.
    if (this.pending) return;

    const query = this.input.value.trim();

    if (!query) {
      this.setStatus(
        'Enter a maintenance question to continue.',
        'error'
      );

      this.input.focus();
      return;
    }

    // Prevent duplicate rapid submissions of the same text.
    const now = Date.now();

    if (
      query === this.lastSubmittedQuery &&
      now - this.lastSubmittedAt < 1000
    ) {
      return;
    }

    this.lastSubmittedQuery = query;
    this.lastSubmittedAt = now;

    // If editing, remove the selected question and everything
    // that came after it before sending the replacement.
    if (this.editingMessageIndex !== null) {
      this.messages = this.messages.slice(
        0,
        this.editingMessageIndex
      );

      this.editingMessageIndex = null;
    }

    // Capture previous conversation before adding this question.
    const history = this.messages
      .filter(
        (message) =>
          message.role === 'user' ||
          message.role === 'assistant'
      )
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));

    // Lock immediately, before changing the chat.
    this.pending = true;
    this.sendButton.disabled = true;
    const requestId = ++this.requestId;
    this.requestController = new AbortController();

    this.messages.push({
      role: 'user',
      content: query,
    });

    this.saveMessages();

    this.input.value = '';
    this.input.style.height = 'auto';

    this.setStatus(
      'Searching maintenance references...',
      'loading'
    );

    this.renderMessages();

    try {
      const result = await chatMaintenanceApi({
        query,
        machine_context: this.getMachineContext() || {},
        top_k: 5,
        history,
        signal: this.requestController.signal,
      });

      if (requestId !== this.requestId) return;

      if (
        typeof result.answer !== 'string' ||
        !result.answer.trim()
      ) {
        throw new Error(
          'The backend response did not contain a usable answer.'
        );
      }

      this.lastFailedQuery = null;
      this.messages.push({
        role: 'assistant',
        content: result.answer,
        sources: Array.isArray(result.sources)
          ? result.sources
          : [],
        animate: true,
      });

      this.saveMessages();
      this.setStatus('', '');
    } catch (error) {
      if (requestId !== this.requestId) return;
      console.error('Maintenance assistant error:', error);
      this.lastFailedQuery = query;
      this.setStatus(
        this.getUsefulErrorMessage(error),
        'error'
      );
    } finally {
      if (requestId === this.requestId) {
        this.pending = false;
        this.requestController = null;
        this.sendButton.disabled = false;

        this.renderMessages();
        this.input.focus();
      }
    }
  }

  getUsefulErrorMessage(error) {
    const message = String(error?.message || 'Unknown error');
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return 'Could not reach the maintenance service. Check that the backend is running and the API URL is correct.';
    }
    if (/timed out/i.test(message)) {
      return 'The maintenance service took too long to respond. Check the backend and try again.';
    }
    if (/HTTP 401|HTTP 403/i.test(message)) {
      return 'Your session may have expired. Sign in again, then retry your question.';
    }
    if (/HTTP 503/i.test(message)) {
      return 'The maintenance service is temporarily unavailable. Check its Gemini configuration and RAG vector store, then retry.';
    }
    if (/invalid JSON|usable answer/i.test(message)) {
      return 'The maintenance service returned an unreadable answer. Please retry.';
    }
    return 'The maintenance service returned an error. Please retry; details are available in the browser console.';
  }

  retryLastQuestion() {
    if (this.pending || !this.lastFailedQuery) return;
    const lastUserIndex = this.messages.findLastIndex?.(
      (message) => message.role === 'user' && message.content === this.lastFailedQuery
    ) ?? -1;
    if (lastUserIndex >= 0) this.messages.splice(lastUserIndex, 1);
    this.input.value = this.lastFailedQuery;
    this.resizeInput();
    this.setStatus('', '');
    this.saveMessages();
    this.renderMessages();
    this.send();
  }

  setStatus(message, state) {
    this.statusElement.textContent = message;
    this.statusElement.hidden = !message;
    this.statusElement.dataset.state = state;
  }

  // Create icon-only buttons for message actions.
  createIconButton(icon, title, onClick) {
    const button = document.createElement('button');

    button.type = 'button';

    button.className =
      `maintenance-assistant-icon-button is-${icon}`;

    button.title = title;
    button.setAttribute('aria-label', title);

    const icons = {
      copy: `
        <rect x="8" y="8" width="12" height="12" rx="2"/>
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
      `,

      edit: `
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>
      `,

      speaker: `
        <path d="M11 5 6 9H2v6h4l5 4V5Z"/>
        <path d="M15.5 8.5a5 5 0 0 1 0 7"/>
        <path d="M19 5a10 10 0 0 1 0 14"/>
      `
    };

    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );

    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');

    svg.innerHTML = icons[icon];

    button.appendChild(svg);
    button.addEventListener('click', onClick);

    return button;
  }

  // Animate new assistant responses character by character.
  animateTyping(element, text) {
    const fullText = String(text || '');

    element.textContent = '';
    element.classList.add('is-typing');

    let index = 0;

    const typeNext = () => {
      index = Math.min(index + 1, fullText.length);

      element.textContent = fullText.slice(0, index);

      this.messagesElement.scrollTop =
        this.messagesElement.scrollHeight;

      if (index < fullText.length) {
        setTimeout(typeNext, 30);
      } else {
        element.classList.remove('is-typing');
        this.renderMarkdown(element, fullText);
      }
    };

    typeNext();
  }

  // Render a small safe Markdown subset using text nodes and known elements only.
  renderMarkdown(container, markdown) {
    container.replaceChildren();
    const lines = String(markdown).split('\n');
    let list = null;
    let listType = null;
    const inline = (parent, value) => {
      const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
      let cursor = 0;
      for (const match of value.matchAll(pattern)) {
        parent.append(document.createTextNode(value.slice(cursor, match.index)));
        const token = match[0];
        const tag = token.startsWith('**') ? 'strong' : token.startsWith('`') ? 'code' : 'em';
        const element = document.createElement(tag);
        element.textContent = token.startsWith('**') ? token.slice(2, -2) : token.slice(1, -1);
        parent.append(element);
        cursor = match.index + token.length;
      }
      parent.append(document.createTextNode(value.slice(cursor)));
    };
    for (const line of lines) {
      const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
      const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (bullet || numbered) {
        const type = bullet ? 'ul' : 'ol';
        if (type !== listType) {
          list = document.createElement(type);
          container.append(list);
          listType = type;
        }
        const item = document.createElement('li');
        inline(item, (bullet || numbered)[1]);
        list.append(item);
        continue;
      }
      list = null;
      listType = null;
      if (!line.trim()) {
        container.append(document.createElement('br'));
      } else if (heading) {
        const title = document.createElement(`h${Math.min(6, heading[1].length + 2)}`);
        inline(title, heading[2]);
        container.append(title);
      } else {
        const paragraph = document.createElement('span');
        inline(paragraph, line);
        container.append(paragraph, document.createElement('br'));
      }
    }
  }

  // Stop speech and reset the speaker button.
  stopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    this.activeUtterance = null;

    this.activeSpeakerButton?.classList.remove(
      'is-speaking'
    );

    if (this.activeSpeakerButton) {
      this.activeSpeakerButton.title = 'Read answer aloud';

      this.activeSpeakerButton.setAttribute(
        'aria-label',
        'Read answer aloud'
      );
    }

    this.activeSpeakerButton = null;
  }

  // Read an assistant answer aloud.
  speak(text, button) {
    if (!('speechSynthesis' in window)) {
      this.setStatus(
        'Speech is not supported in this browser.',
        'error'
      );

      return;
    }

    // Tap the active speaker again to stop.
    if (
      this.activeSpeakerButton === button &&
      window.speechSynthesis.speaking
    ) {
      this.stopSpeech();
      return;
    }

    // Stop any other answer currently being spoken.
    this.stopSpeech();

    // Remove code blocks, formatting, and emoji from speech.
    const cleanText = String(text)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s*/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, '')
      .replace(/^\s*[-*_]{3,}\s*$/gm, '')
      .replace(/\*\*|__|~~|[*_~]/g, '')
      .replace(
        /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance =
      new SpeechSynthesisUtterance(cleanText);

    this.activeUtterance = utterance;
    this.activeSpeakerButton = button;

    utterance.rate = 0.92;
    utterance.pitch = 1;

    button.classList.add('is-speaking');
    button.title = 'Stop speaking';

    button.setAttribute(
      'aria-label',
      'Stop speaking'
    );

    utterance.onend = () => {
      if (this.activeUtterance === utterance) {
        this.stopSpeech();
      }
    };

    utterance.onerror = () => {
      if (this.activeUtterance === utterance) {
        this.stopSpeech();
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  renderMessages() {
    if (!this.messagesElement) return;

    this.messagesElement.replaceChildren();

    if (!this.messages.length) {
      const welcome = document.createElement('div');

      welcome.className =
        'maintenance-assistant-welcome';

      const heading = document.createElement('h3');

      heading.textContent =
        'What do you need to investigate?';

      const description = document.createElement('p');

      description.textContent =
        'Ask about equipment faults, maintenance procedures, or machine health.';

      const suggestions = [
        {
          title: 'Diagnose a fault',
          question:
            'How can I troubleshoot an unexpected machine failure?',
          icon: '⚙',
        },
        {
          title: 'Maintenance procedure',
          question:
            'What should I check during preventive maintenance?',
          icon: '⌁',
        },
        {
          title: 'Understand machine health',
          question:
            'What do the machine health and anomaly scores mean?',
          icon: '◈',
        },
        {
          title: 'Safety checklist',
          question:
            'What safety precautions should I follow before maintenance?',
          icon: '⛨',
        },
      ];

      const grid = document.createElement('div');

      grid.className =
        'maintenance-assistant-suggestions';

      suggestions.forEach(({ title, question, icon }) => {
        const button = document.createElement('button');

        button.type = 'button';

        button.className =
          'maintenance-assistant-suggestion';

        const symbol = document.createElement('span');

        symbol.className =
          'maintenance-assistant-suggestion-icon';

        symbol.textContent = icon;

        const text = document.createElement('span');

        text.textContent = title;

        button.append(symbol, text);

        button.addEventListener('click', () => {
          if (this.pending) return;

          this.input.value = question;
          this.resizeInput();
          this.input.focus();

          this.form.requestSubmit();
        });

        grid.appendChild(button);
      });

      welcome.append(heading, description, grid);

      this.messagesElement.appendChild(welcome);
    }

    this.messages.forEach((message) => {
      const item = document.createElement('article');

      item.className =
        `maintenance-assistant-message is-${message.role}`;

      const label = document.createElement('p');

      label.className =
        'maintenance-assistant-message-label';

      label.textContent =
        message.role === 'user'
          ? 'YOU'
          : message.role === 'assistant'
            ? 'ASSISTANT'
            : 'SERVICE MESSAGE';

      const content = document.createElement('p');

      content.className =
        'maintenance-assistant-message-content';

      // Animate only newly received assistant responses.
      if (message.role === 'assistant' && message.animate) {
        message.animate = false;

        this.animateTyping(content, message.content);
      } else {
        if (message.role === 'assistant') this.renderMarkdown(content, message.content);
        else content.textContent = message.content;
      }

      item.append(label, content);

      const actions = document.createElement('div');

      actions.className =
        'maintenance-assistant-message-actions';

      // Copy icon for both questions and answers.
      const copyButton = this.createIconButton(
        'copy',
        'Copy message',
        async () => {
          try {
            await navigator.clipboard.writeText(
              message.content
            );

            copyButton.classList.add('is-copied');
            copyButton.title = 'Copied';

            copyButton.setAttribute(
              'aria-label',
              'Copied'
            );

            setTimeout(() => {
              copyButton.classList.remove('is-copied');
              copyButton.title = 'Copy message';

              copyButton.setAttribute(
                'aria-label',
                'Copy message'
              );
            }, 1200);
          } catch (error) {
            console.error(
              'Could not copy message:',
              error
            );

            this.setStatus(
              'Could not copy the message.',
              'error'
            );
          }
        }
      );

      actions.appendChild(copyButton);

      // Edit icon for user questions only.
      if (message.role === 'user') {
        const editButton = this.createIconButton(
          'edit',
          'Edit question',
          () => {
            if (this.pending) return;

            this.editingMessageIndex =
              this.messages.indexOf(message);

            this.input.value = message.content;
            this.input.focus();

            this.input.setSelectionRange(
              this.input.value.length,
              this.input.value.length
            );

            this.resizeInput();

            this.setStatus(
              'Edit your question and press Enter to resend.',
              'info'
            );
          }
        );

        actions.appendChild(editButton);
      }

      // Speaker icon for assistant answers only.
      if (message.role === 'assistant') {
        const speakerButton = this.createIconButton(
          'speaker',
          'Read answer aloud',
          () => this.speak(
            message.content,
            speakerButton
          )
        );

        actions.appendChild(speakerButton);
        if (Array.isArray(message.sources) && message.sources.length) {
          const details = document.createElement('details');
          details.className = 'maintenance-assistant-sources';
          const summary = document.createElement('summary');
          summary.textContent = `Sources (${message.sources.length})`;
          const list = document.createElement('ul');
          message.sources.forEach((source) => {
            const entry = document.createElement('li');
            const name = source?.source || source?.filename || source?.title || 'Maintenance reference';
            entry.textContent = String(name);
            const excerpt = source?.text || source?.content;
            if (excerpt) {
              const preview = document.createElement('p');
              preview.className = 'maintenance-assistant-source-excerpt';
              preview.textContent = String(excerpt);
              entry.append(preview);
            }
            list.append(entry);
          });
          details.append(summary, list);
          item.append(details);
        }
      }

      item.appendChild(actions);

      // Show messages only, without source documents.
      this.messagesElement.appendChild(item);
    });

    if (this.lastFailedQuery) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'maintenance-assistant-retry';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => this.retryLastQuestion());
      this.messagesElement.append(retry);
    }

    this.messagesElement.scrollTop =
      this.messagesElement.scrollHeight;
  }
}
