import { chatMaintenanceApi } from './api.js';

export class MaintenanceAssistant {
  constructor({ getMachineContext = () => ({}) } = {}) {
    this.getMachineContext = getMachineContext;

    const token = localStorage.getItem('access_token');

    this.storageKey = token
      ? `maintenance-assistant-chat:${token}`
      : 'maintenance-assistant-chat:guest';

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
    this.lastSubmittedQuery = '';
    this.lastSubmittedAt = 0;

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
              rows="2"
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

    root.querySelectorAll('[data-assistant-close]').forEach(
      (button) => {
        button.addEventListener('click', () => this.close());
      }
    );

    // One submission handler only.
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      console.log("Maintenance chat form submitted");
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

    this.messages.push({
      role: 'user',
      content: query,
    });

    this.saveMessages();

    this.input.value = '';

    // Instant response for greetings.
    const greetingPattern =
      /^(hi|hello|hey|hii|hai|good morning|good afternoon|good evening|hlo|yo|sup|wassup|what's up|whats up|howdy|hiya|heya|greetings|gm|good night|gn|how are you|how are u|how r u|how are you doing|how's it going|how is it going|how are things|what's going on|hey there|hi there|hello there|hi chatgpt|hello chatgpt|hey chatgpt|hi assistant|hello assistant|hii bro|hey bro|hi bro|hello bro|👋|👋🏻|😊|🙋|🙋‍♂️|🙋‍♀️)[!. ,]*$/i;

    if (greetingPattern.test(query)) {
      this.messages.push({
        role: 'assistant',
        content:
          'Hi! 👋 How can I help you today? You can ask me about machine faults, maintenance procedures, or troubleshooting.',
      });

      this.saveMessages();
      this.setStatus('', '');
      this.renderMessages();

      this.pending = false;
      this.sendButton.disabled = false;
      this.input.focus();

      return;
    }

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
      });

      if (
        typeof result.answer !== 'string' ||
        !result.answer.trim()
      ) {
        throw new Error(
          'The assistant returned an empty response. Please try again.'
        );
      }

      this.messages.push({
        role: 'assistant',
        content: result.answer,
        sources: Array.isArray(result.sources)
          ? result.sources
          : [],
      });

      this.saveMessages();
      this.setStatus('', '');
    } catch (error) {
      console.error('Maintenance assistant error:', error);

      this.setStatus(
        'The assistant could not respond. Please try again.',
        'error'
      );
    } finally {
      this.pending = false;
      this.sendButton.disabled = false;

      this.renderMessages();
      this.input.focus();
    }
  }

  setStatus(message, state) {
    this.statusElement.textContent = message;
    this.statusElement.hidden = !message;
    this.statusElement.dataset.state = state;
  }

  renderMessages() {
    if (!this.messagesElement) return;

    this.messagesElement.replaceChildren();

    if (!this.messages.length) {
      const empty = document.createElement('p');

      empty.className = 'maintenance-assistant-empty';

      empty.textContent =
        'Ask a focused question about maintenance, symptoms, or troubleshooting.';

      this.messagesElement.appendChild(empty);
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

      function cleanAssistantText(text) {
  return text
    // Convert escaped Markdown characters to normal characters
    .replace(/\\([*#_`~.!])/g, "$1")

    // Remove bold and italic Markdown markers
    .replace(/\*\*/g, "")
    .replace(/(^|\n)\s*\*(?=\s)/g, "$1•")

    // Remove unwanted HTML entities
    .replace(/&#x20;/gi, " ")
    .replace(/&nbsp;/gi, " ")

    // Remove trailing spaces and excessive blank lines
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

content.textContent = cleanAssistantText(message.content);

      item.append(label, content);

      // Show messages only, without source documents.
      this.messagesElement.appendChild(item);
    });

    this.messagesElement.scrollTop =
      this.messagesElement.scrollHeight;
  }
}