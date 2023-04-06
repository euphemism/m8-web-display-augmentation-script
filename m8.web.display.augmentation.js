// ==UserScript==
// @name         M8 Web Display Augmentations
// @description  Clone and move on-screen controls
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @author       euphemism
// @match        https://derkyjadex.github.io/M8WebDisplay/
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const keyCharacterMap = new Map([
    ["left", "◀"],
    ["right", "▶"],
    ["up", "▲"],
    ["down", "▼"],
    ["select", "⇪"],
    ["start", "▷"],
    ["option", "⌥"],
    ["edit", "✱"],
  ]);

  const clones = new Map();

  for (const action of keyCharacterMap.keys()) {
    clones.set(action, []);
  }

  const localStorageKey = "__EINHERION_NEEDS_TO_MOVE_KEYS";

  const style = document.createElement("style");

  style.textContent = `
    .button-container {
      display: flex;
      flex-direction: column;
      flex-gap: 0.5em;
    }

    .delete-clone-button {
      padding: 0.45em;
      position: absolute;
      right: -1.5em;
      top: -1.5em;
    }

    .draggable {
      transform: translate3d(var(--x), var(--y), 0);
    }

    .flex-center {
      align-items: center;
      display: flex;
      justify-content: center;
    }

    .invisible {
      display: none;
    }

    @keyframes jiggle {
      0% {
        transform: translate3d(var(--x), var(--y), 0) rotate(0deg);
      }
      25% {
        transform: translate3d(var(--x), var(--y), 0) rotate(-1deg);
      }
      50% {
        transform: translate3d(var(--x), var(--y), 0) rotate(0deg);
      }
      75% {
        transform: translate3d(var(--x), var(--y), 0) rotate(1deg);
      }
      100% {
        transform: translate3d(var(--x), var(--y), 0) rotate(0deg);
      }
    }

    .jiggle {
      animation-name: jiggle;
      animation-iteration-count: infinite;
      animation-timing-function: ease-in-out;
    }
    `;

  document.head.appendChild(style);

  const makeDraggable = (parentId) => {
    let isDragging = false;
    let currentElement = null;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    let isLocked = true;

    const parent = document.getElementById(parentId);
    if (!parent) return;

    const children = parent.children;

    const actionToActionElementMap = new Map();

    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      child.classList.add("draggable");
      child.classList.add("flex-center");
      child.classList.add("jiggle");
      child.innerHTML = keyCharacterMap.get(children[i].dataset.action);

      actionToActionElementMap.set(child.dataset.action, child);
    }

    const parseCachedCoords = (el) => {
      const parsedCachedX = parseInt(el.dataset.x);
      const parsedCachedY = parseInt(el.dataset.y);

      return {
        x: isNaN(parsedCachedX) ? 0 : parsedCachedX,
        y: isNaN(parsedCachedY) ? 0 : parsedCachedY,
      };
    };

    const addDeleteButtonToClone = (el) => {
      const deleteButton = document.createElement("button");
      deleteButton.classList.add("delete-clone-button");
      deleteButton.classList.add("flex-center");
      deleteButton.innerText = "x";
      deleteButton.dataset.delete = "1";
      deleteButton.addEventListener("click", () => {
        const actionClones = clones.get(el.dataset.action);
        const i = actionClones.findIndex((item) => item === el);

        if (i >= 0) {
          actionClones.splice(i, 1);
        }

        el.remove();

        persistKeyPositionsToLocalStorage();
      });

      el.appendChild(deleteButton);
    };

    const cloneActionButton = (el) => {
      const clonedAction = el.cloneNode(true);

      clonedAction.dataset.clone = "true";
      clonedAction.dataset.x = clonedAction.dataset.x + 5;
      clonedAction.dataset.y = clonedAction.dataset.y + 5;
      clonedAction.style.borderStyle = "dashed";

      addDeleteButtonToClone(clonedAction);

      clones.get(el.dataset.action).push(clonedAction);

      parent.appendChild(clonedAction);

      return clonedAction;
    };

    const hydrateKeyPositionsFromLocalStorage = () => {
      const cachedPositions = localStorage.getItem(localStorageKey);

      if (cachedPositions != null) {
        const parsedCachedPositions = JSON.parse(cachedPositions);

        actionToActionElementMap.forEach((el, action) => {
          parsedCachedPositions[action].forEach(({ x, y }, i) => {
            const hydratedElement = i === 0 ? el : cloneActionButton(el);

            hydratedElement.dataset.x = x;
            hydratedElement.dataset.y = y;

            setTranslate(0, 0, hydratedElement);
          });
        });
      }
    };

    const toggleDeleteCloneButtons = (show) => {
      document.querySelectorAll(".delete-clone-button").forEach((el) => {
        if (show) {
          el.classList.remove("invisible");
        } else {
          el.classList.add("invisible");
        }
      });
    };

    hydrateKeyPositionsFromLocalStorage();
    toggleDeleteCloneButtons(false);

    const persistKeyPositionsToLocalStorage = (reset = false) => {
      const actionPositions = {};

      actionToActionElementMap.forEach((el, action) => {
        const actions = [el, ...clones.get(action)];

        actionPositions[action] = actions.map((action) =>
          reset ? { x: 0, y: 0 } : parseCachedCoords(action)
        );
      });

      localStorage.setItem(localStorageKey, JSON.stringify(actionPositions));
    };

    const deleteClones = () => {
      clones.forEach((items) => {
        items.forEach((clone) => clone.remove());
        items.splice(0, items.length);
      });
    };

    const resetKeyPositions = () => {
      deleteClones();
      persistKeyPositionsToLocalStorage(true);
      hydrateKeyPositionsFromLocalStorage();
    };

    const resetButton = document.createElement("button");
    resetButton.innerText = "↺";
    resetButton.style.marginBottom = "0.25em";

    resetButton.addEventListener("click", resetKeyPositions);

    const toggleButton = document.createElement("button");
    toggleButton.innerText = "🔒";

    toggleButton.addEventListener("click", () => {
      toggleDeleteCloneButtons(isLocked);
      if (isLocked) {
        toggleButton.innerText = "🔓";
        toggleButton.style.transform = "rotate(15deg)";

        document.querySelectorAll(".draggable").forEach((el) => {
          document.querySelectorAll(".jiggle").forEach((el) => {
            el.style.animationDelay = `calc(${Math.random().toFixed(2)} * -1s)`;
          });

          el.style.animation = "jiggle 0.35s infinite";
        });
      } else {
        toggleButton.innerText = "🔒";
        toggleButton.style.transform = "";

        document.querySelectorAll(".draggable").forEach((el) => {
          el.style.animation = "";
        });
      }

      isLocked = !isLocked;
    });

    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("button-container");
    buttonContainer.style.position = "fixed";
    buttonContainer.style.bottom = "10px";
    buttonContainer.style.right = "10px";

    buttonContainer.appendChild(resetButton);
    buttonContainer.appendChild(toggleButton);

    document.body.appendChild(buttonContainer);

    document.addEventListener("touchstart", dragStart, {
      capture: true,
    });
    document.addEventListener("touchend", dragEnd, {
      capture: true,
    });
    document.addEventListener("touchmove", drag, {
      capture: true,
    });

    document.addEventListener("mousedown", dragStart, {
      capture: true,
    });
    document.addEventListener("mouseup", dragEnd, {
      capture: true,
    });
    document.addEventListener("mousemove", drag, {
      capture: true,
    });
    document.addEventListener("dblclick", doubleClick, { capture: true });

    function dragStart(e) {
      if (e.target.classList.contains("draggable") && !isLocked) {
        e.stopPropagation();

        console.log("drag start");

        initialX = e.clientX;
        initialY = e.clientY;

        if (e.target === toggleButton) {
          return;
        }

        currentElement = e.target;

        if (e.type === "touchstart") {
          initialX = e.touches[0].clientX;
          initialY = e.touches[0].clientY;
        }

        isDragging = true;
      }
    }

    function doubleClick(e) {
      if (e.target.dataset.action && !e.target.dataset.clone && !isLocked) {
        e.preventDefault();

        cloneActionButton(e.target);
      }
    }

    function dragEnd(e) {
      if (e.target.dataset.action && !e.target.dataset.delete && !isLocked) {
        e.preventDefault();

        isDragging = false;

        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        if (e.type === "touchmove") {
          currentX = e.touches[0].clientX - initialX;
          currentY = e.touches[0].clientY - initialY;
        }

        const { x, y } = parseCachedCoords(currentElement);

        currentElement.dataset.x = currentX + x;
        currentElement.dataset.y = currentY + y;

        persistKeyPositionsToLocalStorage();

        currentElement = null;
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();

        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        if (e.type === "touchmove") {
          currentX = e.touches[0].clientX - initialX;
          currentY = e.touches[0].clientY - initialY;
        }

        setTranslate(currentX, currentY, currentElement);
      }
    }

    function setTranslate(xPos, yPos, el) {
      const { x, y } = parseCachedCoords(el);

      el.style.setProperty("--x", `${xPos + x}px`);
      el.style.setProperty("--y", `${yPos + y}px`);
    }
  };

  makeDraggable("controls");
})();
