/* Shared keyboard and background handling for the app's existing dialogs. */
(function () {
  "use strict";
  const dismissers = {
    contactDetailSheet: "closeContactDetail_",
    departmentSheet: "closeDepartmentBrowser_",
    adminFocusSheet: "closeAdminFocusSheet_",
    monthlyInternsAdminModal: "closeMonthlyInternsAdmin_",
    pharmacologyAdminModal: "closePharmacologyAdmin_",
    recentContactsModal: "closeRecentContactsModal",
    myProfileModal: "closeMyProfileModal",
    contactAddModal: "closeContactAddModal_",
    contactReportModal: "closeContactReportModal",
    adminManagerModal: "closeManagerModal",
    adminEditModal: "closeAdminEditModal",
    adminReasonModal: "closeAdminReasonModal_",
    adminConfirmModal: "resolveAdminConfirmation_"
  };
  const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')];
  const opened = new Map();
  const backgroundState = new Map();
  let sequence = 0;
  let activeDialog = null;
  let originalOverflow = "";
  let lastInteractionTarget = null;
  const draftDialogs = new Set(["myProfileModal", "contactAddModal", "contactReportModal", "adminEditModal"]);
  const fieldValues = dialog => [...dialog.querySelectorAll("input, select, textarea")]
    .filter(field => !field.readOnly && !field.disabled && !["password", "hidden", "file"].includes(field.type))
    .map(field => [field.id, field.type === "checkbox" || field.type === "radio" ? field.checked : field.value]);
  function hasDraft(dialog) {
    const state = opened.get(dialog);
    return Boolean(state && dialog.classList.contains("visible") && draftDialogs.has(dialog.id) && JSON.stringify(fieldValues(dialog)) !== state.initialValues);
  }
  window.confirmDialogClose_ = id => {
    const dialog = document.getElementById(id);
    return !hasDraft(dialog) || window.confirm("יש שינויים שטרם נשמרו. לסגור ולוותר עליהם?");
  };
  window.captureDialogDraft_ = id => JSON.stringify(fieldValues(document.getElementById(id)));
  window.markDialogSaved_ = (id, savedValues) => {
    const dialog = document.getElementById(id);
    const state = opened.get(dialog);
    if (state) state.initialValues = typeof savedValues === "string" ? savedValues : JSON.stringify(fieldValues(dialog));
  };
  window.addEventListener("beforeunload", event => {
    if (![...opened.keys()].some(hasDraft)) return;
    event.preventDefault();
    event.returnValue = "";
  });

  // One same-URL history entry protects the underlying page while a dialog is open.
  // Forward never replays a form, saved action, or stale person snapshot.
  const historyKey = "contactsDialog";
  const historyToken = `${Date.now()}-${Math.random()}`;
  let historyPending = false;
  let handlingBack = false;
  const ownsHistoryEntry = () => window.history.state?.[historyKey] === historyToken;
  function synchronizeHistory() {
    if (historyPending || handlingBack) return;
    if (activeDialog && !ownsHistoryEntry()) {
      window.history.pushState({ ...window.history.state, [historyKey]: historyToken }, "", window.location.href);
    } else if (!activeDialog && ownsHistoryEntry()) {
      historyPending = true;
      window.history.back();
    }
  }
  function dismissActive() {
    if (!activeDialog) return;
    const dismiss = window[dismissers[activeDialog.id]];
    if (typeof dismiss === "function") {
      if (activeDialog.id === "adminConfirmModal") dismiss(false);
      else dismiss();
    }
  }
  window.addEventListener("popstate", () => {
    if (historyPending) {
      historyPending = false;
      synchronizeHistory();
      return;
    }
    if (activeDialog && !ownsHistoryEntry()) {
      handlingBack = true;
      dismissActive();
      synchronize();
      handlingBack = false;
      synchronizeHistory();
    } else if (!activeDialog && ownsHistoryEntry()) {
      const state = { ...window.history.state };
      delete state[historyKey];
      window.history.replaceState(state, "", window.location.href);
    }
  });

  function visible(element) {
    return Boolean(element && element.isConnected && !element.closest('[hidden], [inert]') && element.getClientRects().length);
  }

  function focusTitle(dialog) {
    const title = document.getElementById(dialog.getAttribute("aria-labelledby"));
    const target = title && dialog.contains(title) ? title : dialog;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  function restoreBackground() {
    backgroundState.forEach((state, element) => {
      element.inert = state.inert;
      if (state.ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", state.ariaHidden);
    });
    backgroundState.clear();
  }

  function synchronize() {
    const prior = activeDialog;
    const priorState = prior && opened.get(prior);
    restoreBackground();
    function openerFor(dialog) {
      let candidate = dialog.contains(document.activeElement) ? lastInteractionTarget : document.activeElement;
      const visited = new Set();
      while (candidate && !visited.has(candidate)) {
        visited.add(candidate);
        const closedParent = [...opened.keys()].find(item => item.contains(candidate) && !item.classList.contains("visible"));
        if (!closedParent) break;
        candidate = opened.get(closedParent).opener;
      }
      return candidate;
    }
    // Record additions before removing closed parents, for sheet-to-form transitions.
    dialogs.filter(dialog => dialog.classList.contains("visible") && !opened.has(dialog)).forEach(dialog => {
      opened.set(dialog, { opener: openerFor(dialog), sequence: ++sequence, initialValues: JSON.stringify(fieldValues(dialog)) });
    });
    dialogs.forEach(dialog => {
      if (dialog.classList.contains("visible")) {
        if (!opened.has(dialog)) opened.set(dialog, {
          opener: document.activeElement,
          sequence: ++sequence, initialValues: JSON.stringify(fieldValues(dialog))
        });
        dialog.setAttribute("aria-hidden", "false");
      } else {
        opened.delete(dialog);
        dialog.setAttribute("aria-hidden", "true");
      }
    });
    activeDialog = [...opened.keys()].sort((left, right) =>
      Number(getComputedStyle(left).zIndex || 0) - Number(getComputedStyle(right).zIndex || 0) ||
      opened.get(left).sequence - opened.get(right).sequence
    ).pop() || null;
    if (activeDialog) {
      if (!prior) originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      // Dialogs are body children today; walking ancestors also supports nesting.
      let branch = activeDialog;
      while (branch && branch !== document.body) {
        [...branch.parentElement.children].forEach(sibling => {
          if (sibling === branch || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) return;
          backgroundState.set(sibling, { inert: sibling.inert, ariaHidden: sibling.getAttribute("aria-hidden") });
          sibling.inert = true;
          sibling.setAttribute("aria-hidden", "true");
        });
        branch = branch.parentElement;
      }
      if (activeDialog !== prior) {
        const restoreTarget = priorState && priorState.opener;
        if (restoreTarget && activeDialog.contains(restoreTarget) && visible(restoreTarget)) restoreTarget.focus({ preventScroll: true });
        else focusTitle(activeDialog);
      }
    } else if (prior) {
      // Existing closers also clear overflow. Never keep a stale lock from an opener.
      document.body.style.overflow = originalOverflow === "hidden" ? "" : originalOverflow;
      const opener = priorState && priorState.opener;
      if (visible(opener)) opener.focus({ preventScroll: true });
    }
    synchronizeHistory();
  }

  document.addEventListener("click", event => {
    lastInteractionTarget = event.target.closest("button, a, input, select, textarea, [tabindex]") || document.activeElement;
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key !== "Tab" && event.key !== "Escape") lastInteractionTarget = document.activeElement;
    synchronize();
    if (!activeDialog) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      dismissActive();
      synchronize();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...activeDialog.querySelectorAll(
      'a[href], button, input, select, textarea, summary, [tabindex]'
    )].filter(element => !element.disabled && element.tabIndex >= 0 &&
      !element.classList.contains("directorySheetBackdrop") && visible(element));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first) {
      event.preventDefault();
      focusTitle(activeDialog);
    } else if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }, true);

  document.addEventListener("focusin", event => {
    if (activeDialog && !activeDialog.contains(event.target)) focusTitle(activeDialog);
  });
  const observer = new MutationObserver(synchronize);
  dialogs.forEach(dialog => observer.observe(dialog, { attributes: true, attributeFilter: ["class"] }));
  synchronize();
})();
