/**
 * Industrial Maintenance Prognostics — AI Maintenance Copilot Controller
 * Interfaces with FastAPI RAG endpoint (/api/rag/chat) with live telemetry context injection.
 */

const Copilot = (() => {
  const history = [];
  const MAX_HISTORY = 8;
  let isSending = false;

  // Simple Markdown parser for clean matte industrial display
  function formatMarkdown(text) {
    if (!text) return "";
    let html = text
      // Escape HTML tags to prevent XSS
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h4 style="font-size: 13px; font-weight: 700; margin: 10px 0 4px; color: var(--text-white); text-transform: uppercase;">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="font-size: 14px; font-weight: 700; margin: 12px 0 6px; color: var(--text-white);">$1</h3>');

    // Bold & italic
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Bullet lists
    const lines = html.split("\n");
    let inList = false;
    const formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const bulletMatch = line.match(/^\s*[\*\-]\s+(.*)/);
      const numberMatch = line.match(/^\s*\d+\.\s+(.*)/);

      if (bulletMatch) {
        if (!inList) {
          formattedLines.push('<ul style="margin: 6px 0 6px 18px; padding: 0;">');
          inList = true;
        }
        formattedLines.push(`<li>${bulletMatch[1]}</li>`);
      } else if (numberMatch) {
        if (!inList) {
          formattedLines.push('<ol style="margin: 6px 0 6px 18px; padding: 0;">');
          inList = true;
        }
        formattedLines.push(`<li>${numberMatch[1]}</li>`);
      } else {
        if (inList) {
          formattedLines.push("</ul>");
          inList = false;
        }
        if (line.trim().length > 0) {
          formattedLines.push(`<p style="margin-bottom: 6px;">${line}</p>`);
        }
      }
    }
    if (inList) formattedLines.push("</ul>");

    return formattedLines.join("");
  }

  function getTimestamp() {
    const d = new Date();
    return d.toTimeString().split(" ")[0];
  }

  function renderMessage(role, content, sources = []) {
    const container = document.getElementById("copilot-chat-messages");
    if (!container) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = `copilot-message copilot-message-${role}`;

    const isUser = role === "user";
    const sender = isUser ? "MAINTENANCE OPERATOR" : "AI MAINTENANCE COPILOT";
    const avatarSvg = isUser
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>`;

    let sourcesHtml = "";
    if (sources && sources.length > 0) {
      const itemsHtml = sources.map((s, idx) => {
        const docName = s.document || `Document [${idx + 1}]`;
        const page = s.page !== undefined ? `Page ${s.page}` : "";
        const snippet = s.text ? s.text.substring(0, 180) + (s.text.length > 180 ? "..." : "") : "";
        return `
          <div class="copilot-source-item">
            <div class="copilot-source-title">📄 ${docName} ${page ? `(${page})` : ""}</div>
            <div>${snippet}</div>
          </div>
        `;
      }).join("");

      sourcesHtml = `
        <div class="copilot-sources-box">
          <details>
            <summary class="copilot-sources-toggle">📚 ${sources.length} Grounded Source Excerpt(s) Referenced</summary>
            ${itemsHtml}
          </details>
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="copilot-avatar">
        ${avatarSvg}
      </div>
      <div class="copilot-bubble">
        <div class="copilot-bubble-header">
          <span class="copilot-sender">${sender}</span>
          <span class="copilot-time">${getTimestamp()}</span>
        </div>
        <div class="copilot-text">
          ${isUser ? `<p>${content}</p>` : formatMarkdown(content)}
        </div>
        ${sourcesHtml}
      </div>
    `;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
  }

  function showTypingIndicator() {
    const container = document.getElementById("copilot-chat-messages");
    if (!container) return null;

    const indDiv = document.createElement("div");
    indDiv.id = "copilot-typing-active";
    indDiv.className = "copilot-message copilot-message-assistant";
    indDiv.innerHTML = `
      <div class="copilot-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="10" rx="2"></rect>
          <circle cx="12" cy="5" r="2"></circle>
          <path d="M12 7v4"></path>
        </svg>
      </div>
      <div class="copilot-bubble" style="padding: 10px 14px;">
        <div class="copilot-typing-indicator">
          <span style="font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); margin-right: 6px;">SEARCHING VECTOR STORE & REASONING</span>
          <div class="copilot-typing-dot"></div>
          <div class="copilot-typing-dot"></div>
          <div class="copilot-typing-dot"></div>
        </div>
      </div>
    `;
    container.appendChild(indDiv);
    container.scrollTop = container.scrollHeight;
    return indDiv;
  }

  function removeTypingIndicator() {
    const ind = document.getElementById("copilot-typing-active");
    if (ind) ind.remove();
  }

  function updateContextBadge() {
    const badge = document.getElementById("copilot-context-badge");
    if (!badge || typeof Dashboard === "undefined" || !Dashboard.getCurrentState) return;

    const st = Dashboard.getCurrentState();
    badge.textContent = `Target: Engine #${st.engine_id} | Cycle ${st.cycle}/${st.max_cycle}`;
  }

  async function handleSend(queryText) {
    if (isSending) return;
    const input = document.getElementById("copilot-input");
    const query = (queryText || (input ? input.value : "")).trim();
    if (!query) return;

    if (input) {
      input.value = "";
      input.style.height = "auto";
    }

    // Render user message
    renderMessage("user", query);

    // Prepare machine context
    let machineContext = {};
    const injectCheckbox = document.getElementById("copilot-inject-context");
    if (injectCheckbox && injectCheckbox.checked && typeof Dashboard !== "undefined" && Dashboard.getCurrentState) {
      const st = Dashboard.getCurrentState();
      machineContext = {
        engine_id: st.engine_id,
        subsystem: "NASA C-MAPSS FD001 Turbofan",
        current_cycle: st.cycle,
        total_rated_cycles: st.max_cycle,
        condition: `Cycle ${st.cycle} of ${st.max_cycle}`
      };
    }

    isSending = true;
    const sendBtn = document.getElementById("copilot-send-btn");
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = "Processing...";
    }

    showTypingIndicator();

    try {
      const res = await API.askRAG(query, machineContext, 4, history);
      removeTypingIndicator();

      const answer = res && res.answer ? res.answer : "No response received from RAG service.";
      const sources = res && res.sources ? res.sources : [];

      renderMessage("assistant", answer, sources);

      // Append to history
      history.push({ role: "user", content: query });
      history.push({ role: "assistant", content: answer });
      while (history.length > MAX_HISTORY) {
        history.shift();
      }
    } catch (err) {
      removeTypingIndicator();
      renderMessage(
        "assistant",
        `**Error contacting AI Maintenance Assistant:** ${err.message}\n\nPlease check server connection or API key configuration.`
      );
    } finally {
      isSending = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Send";
      }
      if (input) input.focus();
    }
  }

  function clearHistory() {
    history.length = 0;
    const container = document.getElementById("copilot-chat-messages");
    if (!container) return;

    container.innerHTML = `
      <div class="copilot-message copilot-message-assistant">
        <div class="copilot-avatar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="10" rx="2"></rect>
            <circle cx="12" cy="5" r="2"></circle>
            <path d="M12 7v4"></path>
          </svg>
        </div>
        <div class="copilot-bubble">
          <div class="copilot-bubble-header">
            <span class="copilot-sender">AI MAINTENANCE COPILOT</span>
            <span class="copilot-time">${getTimestamp()}</span>
          </div>
          <div class="copilot-text">
            Session history reset. Ready for new technical queries or diagnostics.
          </div>
        </div>
      </div>
    `;
  }

  return {
    init() {
      const form = document.getElementById("copilot-form");
      const input = document.getElementById("copilot-input");
      const clearBtn = document.getElementById("copilot-clear-btn");

      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          handleSend();
        });
      }

      if (input) {
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        });
      }

      if (clearBtn) {
        clearBtn.addEventListener("click", clearHistory);
      }

      // Quick prompt chips
      document.querySelectorAll(".copilot-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const prompt = chip.dataset.prompt;
          if (prompt) handleSend(prompt);
        });
      });

      // Update context badge when switching engines/cycles
      setInterval(updateContextBadge, 1000);
    },

    ask(query) {
      handleSend(query);
    }
  };
})();

// Initialize Copilot on load
document.addEventListener("DOMContentLoaded", () => {
  Copilot.init();
});
