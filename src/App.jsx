import React, { useState, useRef, useEffect } from "react";
import "./App.css";

/* ---------------------------------------------
 * 1) InteractionType + improved inference
 * --------------------------------------------- */
const InteractionType = {
  CLICK: "CLICK",
  TYPE: "TYPE",
  DRAG: "DRAG",
  HOVER: "HOVER",
  FOCUS: "FOCUS",
  SCROLL: "SCROLL",
  SELECT: "SELECT",
};

/**
 * Infers possible interactions based on element tag/type.
 *  - For ANY <input> except "checkbox","radio","button","submit","file", etc. => add TYPE
 *  - For <textarea> => add TYPE
 *  - For <select> => add SELECT + (others)
 *  - For anything => at least HOVER, FOCUS, CLICK
 *  - DRAG => if draggable
 *  - SCROLL => if overflow
 */
function inferPossibleInteractions(el) {
  const tag = el.tagName.toLowerCase();

  // If <input> has no explicit type, treat as "text"
  let typeAttr = (el.getAttribute("type") || "").toLowerCase();
  if (tag === "input" && !typeAttr) {
    typeAttr = "text";
  }

  // Base set for any interactable element
  const possible = new Set([
    InteractionType.HOVER,
    InteractionType.FOCUS,
    InteractionType.CLICK,
  ]);

  // We'll consider these "text-like" types for TYPE interactions
  const textLikeInputs = [
    "text",
    "email",
    "password",
    "search",
    "tel",
    "url",
    "number",
    "date",
    "month",
    "week",
    "time",
    "datetime-local",
    "color", // etc.
    "",
  ];

  if (tag === "textarea") {
    possible.add(InteractionType.TYPE);
  } else if (tag === "input") {
    // If it's not checkbox/radio/button/submit/file/etc., allow TYPE
    if (
      ![
        "checkbox",
        "radio",
        "button",
        "submit",
        "range",
        "file",
        "hidden",
        "image",
      ].includes(typeAttr)
    ) {
      possible.add(InteractionType.TYPE);
    }
  }

  // For <select>, we add SELECT
  if (tag === "select") {
    possible.add(InteractionType.SELECT);
  }

  // If truly draggable, add DRAG
  if (el.draggable || el.getAttribute("draggable") === "true") {
    possible.add(InteractionType.DRAG);
  }

  // If the element is scrollable, add SCROLL
  if (el.scrollHeight > el.clientHeight) {
    possible.add(InteractionType.SCROLL);
  }

  return Array.from(possible);
}

/* ---------------------------------------------
 * 2) Classes for DOM snapshot items
 * --------------------------------------------- */
class ScreenItem {
  constructor({ id, x, y, width, height, tagName, textContent, parentId }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.tagName = tagName;
    this.textContent = textContent;
    this.parentId = parentId;
  }
}

class ScreenInfo extends ScreenItem {
  constructor(props) {
    super(props);
    this.type = "INFO";
    this.alt = props.alt || null;
  }
}

class ScreenAction extends ScreenItem {
  constructor(props) {
    super(props);
    this.type = "ACTION";
    this.placeholder = props.placeholder || null;
    this.href = props.href || null;
    this.possibleInteractions = props.possibleInteractions || [];
    // For <select> elements, store their <option> data
    this.selectOptions = props.selectOptions || [];
  }
}

class ScreenContainer extends ScreenItem {
  constructor(props) {
    super(props);
    this.type = "CONTAINER";
    this.childIds = props.childIds || [];
  }
}

/* ---------------------------------------------
 * 3) Fake cursor logic + utility
 * --------------------------------------------- */
function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Update to your actual images if needed
const CURSOR_IMAGES = {
  pointer: "src/assets/cursor.svg",
  text: "src/assets/text_cursor.svg",
  hand: "src/assets/click.svg",
};

/* ---------------------------------------------
 * 4) Main App
 * --------------------------------------------- */
export default function App() {
  // Automation / Cursor state
  const [isAutomating, setIsAutomating] = useState(false);
  const [cursorMode, setCursorMode] = useState("pointer");
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const cursorPosRef = useRef({ x: 0, y: 0 });

  // Track user’s real mouse
  const defaultPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const [realMousePos, setRealMousePos] = useState(defaultPos);
  const realMousePosRef = useRef(defaultPos);

  // Example UI state
  const [searchValue, setSearchValue] = useState("");

  // DOM Snapshot
  const [domItems, setDomItems] = useState([]);

  // Interaction panel state
  const [selectedItemId, setSelectedItemId] = useState("");
  const [availableInteractions, setAvailableInteractions] = useState([]);
  const [selectedInteraction, setSelectedInteraction] = useState("");

  // For TYPE
  const [interactionText, setInteractionText] = useState("");
  // For DRAG
  const [dragMode, setDragMode] = useState("coords");
  const [dragTargetCoordinate, setDragTargetCoordinate] = useState({
    x: 0,
    y: 0,
  });
  const [dragTargetElementId, setDragTargetElementId] = useState("");
  // For HOVER
  const [hoverDuration, setHoverDuration] = useState(1000);
  // For SCROLL
  const [scrollOffset, setScrollOffset] = useState({ top: 0, left: 0 });
  // For SELECT
  const [selectOptionValue, setSelectOptionValue] = useState("");

  /* ---------------------------------
   * Mouse + window events
   * --------------------------------- */
  useEffect(() => {
    function handleMouseMove(e) {
      if (!isAutomating) {
        const newPos = { x: e.clientX, y: e.clientY };
        setRealMousePos(newPos);
        realMousePosRef.current = newPos;
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isAutomating]);

  // Parse the DOM on mount
  useEffect(() => {
    buildDomSnapshot();
  }, []);

  /* ---------------------------------
   * Build DOM snapshot
   * --------------------------------- */
  function buildDomSnapshot() {
    let idCounter = 1;
    const parsedItems = [];

    function parseElement(el, parentId = null) {
      // 1) Skip if it's in the interaction panel or is the fake cursor
      if (el.classList && el.classList.contains("fake-cursor")) return null;
      if (el.closest(".interaction-panel")) return null;

      // 2) Gather child elements
      const children = Array.from(el.children || []);

      // Recursively parse children first
      const childIds = [];
      for (const childEl of children) {
        const childItemId = parseElement(childEl, null);
        if (childItemId) {
          childIds.push(childItemId);
        }
      }

      // 3) Check if element is visible (non-zero size)
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return null;
      }

      // 4) Basic info
      let textContent = el.textContent.trim();
      const baseProps = {
        id: idCounter,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        tagName: el.tagName,
        textContent,
        parentId,
      };

      // 5) Decide if it's ACTION, INFO, or CONTAINER
      const interactiveTags = ["BUTTON", "INPUT", "A", "SELECT", "TEXTAREA"];
      const isInteractive = interactiveTags.includes(el.tagName);

      if (isInteractive) {
        // It's an ACTION. (Potentially a <select> with options, etc.)
        // ... gather placeholder, possible interactions, etc.
        let selectOptions = [];
        if (el.tagName.toLowerCase() === "select") {
          const optionEls = Array.from(el.querySelectorAll("option"));
          selectOptions = optionEls.map((opt) => ({
            value: opt.value,
            text: opt.textContent.trim(),
          }));
        }
        const actionProps = {
          ...baseProps,
          // For example:
          placeholder: el.getAttribute("placeholder") || null,
          href: el.getAttribute("href") || null,
          possibleInteractions: inferPossibleInteractions(el),
          // If <select>, gather <option> data, etc.
          selectOptions,
        };
        const actionItem = new ScreenAction(actionProps);
        parsedItems.push(actionItem);

        el.setAttribute("data-screen-id", String(idCounter));

        idCounter++;
        return actionItem.id;
      } else if (children.length > 0) {
        // Potentially a container
        if (childIds.length > 0) {
          // If the container has valid child items, we treat it as a CONTAINER
          // BUT we clear out its text to avoid duplicating child text.
          baseProps.textContent = ""; // <--- Clear the parent text

          const containerItem = new ScreenContainer({
            ...baseProps,
            childIds,
          });
          parsedItems.push(containerItem);

          el.setAttribute("data-screen-id", String(idCounter));

          idCounter++;
          return containerItem.id;
        } else {
          // If children exist but none were valid => maybe this is just text
          if (textContent.length > 0) {
            const infoItem = new ScreenInfo(baseProps);
            parsedItems.push(infoItem);

            el.setAttribute("data-screen-id", String(idCounter));

            idCounter++;
            return infoItem.id;
          } else {
            return null;
          }
        }
      } else {
        // No children => could be plain text
        if (textContent.length > 0) {
          // It's an INFO node
          const infoItem = new ScreenInfo(baseProps);
          parsedItems.push(infoItem);

          el.setAttribute("data-screen-id", String(idCounter));

          idCounter++;
          return infoItem.id;
        } else {
          return null;
        }
      }
    }

    // Start parsing from document.body
    parseElement(document.body, null);

    // Finally, set to state or wherever you're storing
    setDomItems(parsedItems);
  }

  /* ---------------------------------
   * Start / Stop Automation
   * --------------------------------- */
  function startAutomation() {
    // Start from real mouse position
    const startPos = realMousePosRef.current;
    cursorPosRef.current = startPos;
    setCursorPos(startPos);
    setIsAutomating(true);
  }

  function stopAutomation() {
    setIsAutomating(false);
    setCursorMode("pointer");
  }

  /* ---------------------------------
   * Animate the fake cursor
   * --------------------------------- */
  async function animateCursorTo(x, y) {
    return new Promise((resolve) => {
      const speed = 10;
      let { x: currentX, y: currentY } = cursorPosRef.current;

      function step() {
        const dx = x - currentX;
        const dy = y - currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < speed) {
          currentX = x;
          currentY = y;
          cursorPosRef.current = { x: currentX, y: currentY };
          setCursorPos({ x: currentX, y: currentY });
          resolve();
        } else {
          const angle = Math.atan2(dy, dx);
          currentX += speed * Math.cos(angle);
          currentY += speed * Math.sin(angle);
          cursorPosRef.current = { x: currentX, y: currentY };
          setCursorPos({ x: currentX, y: currentY });
          requestAnimationFrame(step);
        }
      }
      requestAnimationFrame(step);
    });
  }

  /* ---------------------------------
   * Find DOM element by screen ID
   * --------------------------------- */
  function findActualElementById(id) {
    return document.querySelector(`[data-screen-id="${id}"]`);
  }

  /* ---------------------------------
   * Low-level interactions
   * --------------------------------- */
  function clickElement(el) {
    el.click();
  }

  async function typeInElement(el, text) {
    // If it's the top search bar
    if (el.classList.contains("search-input")) {
      for (let i = 0; i < text.length; i++) {
        setSearchValue((prev) => prev + text[i]);
        await delay(60 + Math.random() * 40);
      }
    } else {
      // dispatch real input events
      for (let i = 0; i < text.length; i++) {
        el.value = (el.value || "") + text[i];
        const evt = new Event("input", { bubbles: true });
        el.dispatchEvent(evt);
        await delay(60 + Math.random() * 40);
      }
    }
  }

  /* ---------------------------------
   * Perform Interaction
   * --------------------------------- */
  async function handlePerformInteraction() {
    if (!selectedItemId || !selectedInteraction) {
      alert("Please select an element and an interaction.");
      return;
    }
    const item = domItems.find((d) => d.id === Number(selectedItemId));
    if (!item) {
      alert("Invalid item selected.");
      return;
    }

    startAutomation();
    setCursorMode("pointer");

    try {
      // 1) Scroll element into view
      const el = findActualElementById(item.id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

      // Wait for scroll
      await delay(600);

      // 2) Re-check bounding rect in case scrolling changed it
      const newRect = el.getBoundingClientRect();
      const targetX = newRect.left + newRect.width / 2;
      const targetY = newRect.top + newRect.height / 2;

      // 3) Animate cursor to new position
      await animateCursorTo(targetX, targetY);

      // 4) Switch on interaction
      switch (selectedInteraction) {
        case InteractionType.CLICK:
          setCursorMode("hand");
          clickElement(el);
          break;

        case InteractionType.TYPE:
          setCursorMode("text");
          await typeInElement(el, interactionText);
          break;

        case InteractionType.DRAG: {
          if (el)
            el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          setCursorMode("hand");

          if (dragMode === "coords") {
            await animateCursorTo(
              dragTargetCoordinate.x,
              dragTargetCoordinate.y
            );
          } else {
            // drag onto another element
            const targetItem = domItems.find(
              (d) => d.id === Number(dragTargetElementId)
            );
            if (targetItem) {
              const dropEl = findActualElementById(targetItem.id);
              if (dropEl) {
                const dropRect = dropEl.getBoundingClientRect();
                const dropX = dropRect.left + dropRect.width / 2;
                const dropY = dropRect.top + dropRect.height / 2;
                await animateCursorTo(dropX, dropY);
              }
            }
          }
          if (el)
            el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
          break;
        }

        case InteractionType.HOVER:
          await delay(hoverDuration);
          break;

        case InteractionType.FOCUS:
          el.focus();
          break;

        case InteractionType.SCROLL:
          el.scrollTo(scrollOffset.left, scrollOffset.top);
          break;

        case InteractionType.SELECT: {
          // For <select>, pick the user-chosen option
          // item.selectOptions => array of { value, text }
          if (el.tagName.toLowerCase() === "select" && selectOptionValue) {
            const options = Array.from(el.querySelectorAll("option"));
            // find the matching option by value
            const matchIndex = options.findIndex(
              (opt) => opt.value === selectOptionValue
            );
            if (matchIndex >= 0) {
              el.selectedIndex = matchIndex;
              const evt = new Event("change", { bubbles: true });
              el.dispatchEvent(evt);
            }
          }
          break;
        }

        default:
          console.warn("Unknown interaction type:", selectedInteraction);
      }
    } catch (err) {
      console.error("Interaction error:", err);
    }

    // done
    stopAutomation();
    // re-parse in case the DOM changed
    buildDomSnapshot();
  }

  /* ---------------------------------
   * Effect: when selected item changes,
   *  update available interactions
   * --------------------------------- */
  useEffect(() => {
    const item = domItems.find((d) => d.id === Number(selectedItemId));
    if (item && item.type === "ACTION") {
      const interactions = item.possibleInteractions || [];
      setAvailableInteractions(interactions);
      if (!interactions.includes(selectedInteraction)) {
        setSelectedInteraction(interactions[0] || "");
      }
      // If it's a <select>, reset the selectOptionValue
      if (item.tagName.toLowerCase() === "select") {
        setSelectOptionValue("");
      }
    } else {
      setAvailableInteractions([]);
      setSelectedInteraction("");
      setSelectOptionValue("");
    }
  }, [selectedItemId, domItems]);

  /* ---------------------------------
   * Handlers for the example UI
   * --------------------------------- */
  function handleSearchChange(e) {
    setSearchValue(e.target.value);
  }
  function handleSearchClick() {
    console.log("Searching for:", searchValue);
  }
  function handleBuy(itemName) {
    alert(`Buying "${itemName}"... (mocked)`);
  }
  function handleFormSubmit(e) {
    e.preventDefault();
    alert("Form submitted! (mock)");
  }

  /* ---------------------------------
   * Render UI
   * --------------------------------- */
  return (
    <div className="app-container">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="brand">MegaStore</div>
        <div className="search-section">
          {/* No explicit type => default is "text" => TYPE allowed */}
          <input
            className="search-input"
            placeholder="Search for products..."
            value={searchValue}
            onChange={handleSearchChange}
          />
          <button className="search-button" onClick={handleSearchClick}>
            Search
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <section className="hero-section">
          <h1>Welcome to MegaStore</h1>
          <p>
            Discover a wide range of products at unbeatable prices. Shop
            electronics, fashion, home appliances, and more!
          </p>
        </section>

        <h2>Featured Products</h2>
        <div className="products-grid">
          <div className="product-card">
            <img
              src="https://picsum.photos/id/1025/200/150"
              alt="Lovely Puppy"
            />
            <h3>Item #1</h3>
            <p>Wireless Headphones</p>
            <button
              className="buy-btn"
              onClick={() => handleBuy("Wireless Headphones")}
            >
              Buy Now
            </button>
          </div>

          <div className="product-card">
            <img src="https://picsum.photos/id/9/200/150" alt="Laptop" />
            <h3>Item #2</h3>
            <p>Gaming Laptop</p>
            <button
              className="buy-btn"
              onClick={() => handleBuy("Gaming Laptop")}
            >
              Buy Now
            </button>
          </div>

          <div className="product-card">
            <img
              src="https://picsum.photos/id/175/200/150"
              alt="Antique Clock"
            />
            <h3>Item #3</h3>
            <p>Smart Home Speaker</p>
            <button
              className="buy-btn"
              onClick={() => handleBuy("Smart Home Speaker")}
            >
              Buy Now
            </button>
          </div>

          <div className="product-card">
            <img src="https://picsum.photos/id/35/200/150" alt="Camera" />
            <h3>Item #4</h3>
            <p>4K Action Camera</p>
            <button
              className="buy-btn"
              onClick={() => handleBuy("4K Action Camera")}
            >
              Buy Now
            </button>
          </div>

          <div className="product-card">
            <img
              src="https://picsum.photos/id/219/200/150"
              alt="Air Purifier"
            />
            <h3>Item #5</h3>
            <p>Portable Air Purifier</p>
            <button
              className="buy-btn"
              onClick={() => handleBuy("Portable Air Purifier")}
            >
              Buy Now
            </button>
          </div>
        </div>

        <section className="info-section">
          <h2>Why Shop With Us?</h2>
          <ul>
            <li>Free shipping on orders over $50</li>
            <li>24/7 customer support</li>
            <li>30-day return policy</li>
            <li>Exclusive discounts and promotions</li>
          </ul>
        </section>

        <section className="extra-section">
          <h3>More to Explore</h3>
          <p>
            We offer accessories, gift cards, extended warranties, and more.
            Stay tuned for new arrivals every week.
          </p>
        </section>

        {/* Example form for further interactions */}
        <section className="form-playground">
          <h2>Join Our Newsletter</h2>
          <form onSubmit={handleFormSubmit}>
            <label>
              Email:
              <input type="email" placeholder="Enter your email" />
            </label>
            <br />
            <label>
              Password:
              <input type="password" placeholder="Create a password" />
            </label>
            <br />
            <label>
              Select your country:
              <select>
                <option value="">--Choose--</option>
                <option value="us">United States</option>
                <option value="uk">United Kingdom</option>
                <option value="ca">Canada</option>
              </select>
            </label>
            <br />
            <div>
              <label>
                <input type="radio" name="updates" /> Receive daily updates
              </label>
              <label>
                <input type="radio" name="updates" /> Receive weekly updates
              </label>
            </div>
            <br />
            <label>
              <input type="checkbox" /> I agree to the Terms of Service
            </label>
            <br />
            <button type="submit">Subscribe</button>
          </form>

          <p>
            Also check out our <a href="#">latest deals</a>!
          </p>
        </section>
      </main>

      {/* FAKE CURSOR */}
      {isAutomating && (
        <img
          src={CURSOR_IMAGES[cursorMode]}
          alt="Fake Cursor"
          className="fake-cursor"
          style={{
            top: cursorPos.y,
            left: cursorPos.x,
          }}
        />
      )}
      {/* Hide real cursor while automating */}
      <style>{isAutomating ? `body { cursor: none !important; }` : ""}</style>

      {/* Interaction Panel */}
      <div className="interaction-panel">
        <h3>DOM Snapshot (JSON)</h3>
        <pre className="json-output">{JSON.stringify(domItems, null, 2)}</pre>
        <button onClick={buildDomSnapshot}>Refresh DOM Snapshot</button>

        <div className="interaction-form">
          {/* Target Element */}
          <label>
            Target Element:
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              style={{ marginLeft: "8px" }}
            >
              <option value="">-- Choose --</option>
              {domItems
                .filter(
                  (item) =>
                    item.type === "ACTION" &&
                    item.possibleInteractions &&
                    item.possibleInteractions.length > 0
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {`#${item.id} <${item.tagName.toLowerCase()}> ${
                      item.textContent ? `"${item.textContent}"` : ""
                    }`}
                  </option>
                ))}
            </select>
          </label>

          {/* Interaction */}
          <label>
            Interaction:
            <select
              value={selectedInteraction}
              onChange={(e) => setSelectedInteraction(e.target.value)}
              style={{ marginLeft: "8px" }}
            >
              {availableInteractions.length === 0 && (
                <option value="">-- None --</option>
              )}
              {availableInteractions.map((interaction) => (
                <option key={interaction} value={interaction}>
                  {interaction}
                </option>
              ))}
            </select>
          </label>

          {/* TYPE -> Show text field */}
          {selectedInteraction === InteractionType.TYPE && (
            <label style={{ marginLeft: "8px" }}>
              Text to Type:
              <input
                type="text"
                value={interactionText}
                onChange={(e) => setInteractionText(e.target.value)}
                style={{ marginLeft: "4px" }}
              />
            </label>
          )}

          {/* DRAG -> coords or onto element */}
          {selectedInteraction === InteractionType.DRAG && (
            <div
              style={{
                marginLeft: "8px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <label>
                Drag Mode:
                <select
                  value={dragMode}
                  onChange={(e) => setDragMode(e.target.value)}
                  style={{ marginLeft: "4px" }}
                >
                  <option value="coords">Coordinates</option>
                  <option value="element">Element</option>
                </select>
              </label>
              {dragMode === "coords" ? (
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <label>
                    X:
                    <input
                      type="number"
                      value={dragTargetCoordinate.x}
                      onChange={(e) =>
                        setDragTargetCoordinate((prev) => ({
                          ...prev,
                          x: Number(e.target.value),
                        }))
                      }
                      style={{ width: "60px", marginLeft: "4px" }}
                    />
                  </label>
                  <label>
                    Y:
                    <input
                      type="number"
                      value={dragTargetCoordinate.y}
                      onChange={(e) =>
                        setDragTargetCoordinate((prev) => ({
                          ...prev,
                          y: Number(e.target.value),
                        }))
                      }
                      style={{ width: "60px", marginLeft: "4px" }}
                    />
                  </label>
                </div>
              ) : (
                <label style={{ marginTop: "4px" }}>
                  Drop onto element:
                  <select
                    value={dragTargetElementId}
                    onChange={(e) => setDragTargetElementId(e.target.value)}
                    style={{ marginLeft: "4px" }}
                  >
                    <option value="">-- Choose --</option>
                    {domItems
                      .filter(
                        (d) => d.type === "ACTION" || d.type === "CONTAINER"
                      )
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {`#${d.id} <${d.tagName.toLowerCase()}> ${
                            d.textContent ? `"${d.textContent}"` : ""
                          }`}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {/* HOVER -> duration */}
          {selectedInteraction === InteractionType.HOVER && (
            <label style={{ marginLeft: "8px" }}>
              Hover (ms):
              <input
                type="number"
                value={hoverDuration}
                onChange={(e) => setHoverDuration(Number(e.target.value))}
                style={{ width: "80px", marginLeft: "4px" }}
              />
            </label>
          )}

          {/* SCROLL -> offsets */}
          {selectedInteraction === InteractionType.SCROLL && (
            <div style={{ display: "flex", gap: "8px", marginLeft: "8px" }}>
              <label>
                Scroll Top:
                <input
                  type="number"
                  value={scrollOffset.top}
                  onChange={(e) =>
                    setScrollOffset((prev) => ({
                      ...prev,
                      top: Number(e.target.value),
                    }))
                  }
                  style={{ width: "60px", marginLeft: "4px" }}
                />
              </label>
              <label>
                Scroll Left:
                <input
                  type="number"
                  value={scrollOffset.left}
                  onChange={(e) =>
                    setScrollOffset((prev) => ({
                      ...prev,
                      left: Number(e.target.value),
                    }))
                  }
                  style={{ width: "60px", marginLeft: "4px" }}
                />
              </label>
            </div>
          )}

          {/* SELECT -> which option */}
          {selectedInteraction === InteractionType.SELECT && (
            <div
              style={{
                marginLeft: "8px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span>Choose an option:</span>
              {(() => {
                const thisItem = domItems.find(
                  (d) => d.id === Number(selectedItemId)
                );
                if (thisItem && thisItem.selectOptions?.length) {
                  return (
                    <select
                      value={selectOptionValue}
                      onChange={(e) => setSelectOptionValue(e.target.value)}
                      style={{ marginTop: "4px" }}
                    >
                      <option value="">--None--</option>
                      {thisItem.selectOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.text} ({opt.value})
                        </option>
                      ))}
                    </select>
                  );
                } else {
                  return <em>No options found.</em>;
                }
              })()}
            </div>
          )}

          {/* Final button */}
          <button
            onClick={handlePerformInteraction}
            style={{ marginLeft: "8px", alignSelf: "flex-start" }}
          >
            Perform Action
          </button>
        </div>
      </div>
    </div>
  );
}
