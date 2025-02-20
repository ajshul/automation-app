import React, { useState, useRef, useEffect } from "react";
import "./App.css";

/* ---------------------------------------------
 * 1) ScreenItem, ScreenInfo, ScreenAction,
 *    InteractionType definitions
 * --------------------------------------------- */

/**
 * InteractionType - enumerates possible interactions.
 */
const InteractionType = {
  CLICK: "CLICK",
  TYPE: "TYPE",
  DRAG: "DRAG",
  // Could add more like HOVER, DOUBLE_CLICK, etc.
};

/**
 * Base interface for all screen items (both interactive and non-interactive).
 */
class ScreenItem {
  constructor({ id, x, y, width, height, tagName, textContent }) {
    this.id = id; // Unique ID assigned by our parser
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.tagName = tagName; // e.g. 'DIV', 'SPAN', 'BUTTON'
    this.textContent = textContent; // Visible text if any
  }
}

/**
 * ScreenInfo - for non-interactable items (e.g., plain text, images, headings).
 */
class ScreenInfo extends ScreenItem {
  constructor(props) {
    super(props);
    this.type = "INFO"; // Distinguishes this as a non-interactive item
    // We can store extra data, like alt text for images:
    this.alt = props.alt || null;
  }
}

/**
 * ScreenAction - for interactable items (e.g., buttons, inputs, links).
 */
class ScreenAction extends ScreenItem {
  constructor(props) {
    super(props);
    this.type = "ACTION";
    // Additional fields that might matter for interaction
    this.placeholder = props.placeholder || null; // for <input> or <textarea>
    this.href = props.href || null; // for <a> links
  }
}

/* ---------------------------------------------
 * 2) Fake cursor logic (similar to the initial example)
 * --------------------------------------------- */

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

const CURSOR_IMAGES = {
  pointer: "src/assets/cursor.svg",
  text: "src/assets/text_cursor.svg",
  hand: "src/assets/click.svg",
};

export default function App() {
  /* -----------------------------
   * State variables
   * ----------------------------- */
  const [isAutomating, setIsAutomating] = useState(false);
  const [cursorMode, setCursorMode] = useState("pointer");
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const cursorPosRef = useRef({ x: 0, y: 0 });

  // Track user’s real mouse position
  const defaultPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const [realMousePos, setRealMousePos] = useState(defaultPos);
  const realMousePosRef = useRef(defaultPos);

  // Example UI state
  const [searchValue, setSearchValue] = useState("");
  const [domItems, setDomItems] = useState([]); // Will hold JSON array of screen items

  // For the user’s manual interactions at the bottom of the screen
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedInteraction, setSelectedInteraction] = useState(
    InteractionType.CLICK
  );
  const [interactionText, setInteractionText] = useState(""); // text to type, if typing
  const [dragTargetCoordinate, setDragTargetCoordinate] = useState({
    x: 0,
    y: 0,
  });

  /* -----------------------------
   * 1) Track real mouse position
   * ----------------------------- */
  useEffect(() => {
    function handleMouseMove(e) {
      if (!isAutomating) {
        const newPos = { x: e.clientX, y: e.clientY };
        setRealMousePos(newPos);
        realMousePosRef.current = newPos;
      }
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isAutomating]);

  /* -----------------------------
   * 2) On initial mount or whenever DOM changes,
   *    parse the DOM into our screenItems array
   * ----------------------------- */
  useEffect(() => {
    // Parse DOM after the first render
    buildDomSnapshot();
  }, []);

  // We can re-run buildDomSnapshot any time we *know* the UI changed
  // (e.g., after an interaction).
  function buildDomSnapshot() {
    // We'll assign incremental IDs
    let idCounter = 1;
    const items = [];

    // Query all elements inside .main-container (or entire document, up to you)
    // For a bigger example, let's parse the entire document body:
    const allElements = document.querySelectorAll("body *");

    allElements.forEach((el) => {
      // Skip the fake cursor element itself to avoid confusion
      if (el.classList.contains("fake-cursor")) return;

      const rect = el.getBoundingClientRect();
      // If it's not visible or has zero size, we might skip it
      if (rect.width === 0 && rect.height === 0) return;

      // Gather common data
      const commonProps = {
        id: idCounter,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        tagName: el.tagName,
        textContent: el.textContent.trim() || "", // might be empty
      };

      // Decide if this is a ScreenAction or ScreenInfo
      if (isInteractable(el)) {
        // e.g., button, input, link, ...
        const actionProps = {
          ...commonProps,
          placeholder: el.getAttribute("placeholder") || null,
          href: el.getAttribute("href") || null,
        };
        items.push(new ScreenAction(actionProps));
      } else {
        // e.g., plain text div, image, heading, paragraph
        const infoProps = {
          ...commonProps,
          alt: el.getAttribute("alt") || null,
        };
        items.push(new ScreenInfo(infoProps));
      }

      idCounter++;
    });

    setDomItems(items);
  }

  // Helper to figure out if an element is "interactive"
  function isInteractable(el) {
    const interactiveTags = ["BUTTON", "INPUT", "A", "SELECT", "TEXTAREA"];
    if (interactiveTags.includes(el.tagName)) return true;
    // We could also check if it has an onClick handler or role="button", etc.
    // For simplicity, just check known interactive tags
    return false;
  }

  /* -----------------------------
   * 3) Fake cursor movement + actions
   * ----------------------------- */
  function startAutomation() {
    // Start from the real mouse position
    const startingPos = realMousePosRef.current;
    cursorPosRef.current = startingPos;
    setCursorPos(startingPos);
    setIsAutomating(true);
  }

  function stopAutomation() {
    setIsAutomating(false);
    setCursorMode("pointer");
  }

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

  function clickElement(el) {
    el.click();
  }

  async function typeInElement(el, text) {
    // For demonstration, we update a known state if it's the search input,
    // otherwise we can just dispatch keyboard events. We'll keep it simple:
    if (el.classList.contains("search-input")) {
      for (let i = 0; i < text.length; i++) {
        setSearchValue((prev) => prev + text[i]);
        await delay(100 + Math.random() * 50);
      }
    } else {
      // Real approach: dispatch KeyboardEvent
      // (But this doesn't always update React state unless React sees them).
      for (let i = 0; i < text.length; i++) {
        const evt = new Event("input", { bubbles: true });
        el.value = (el.value || "") + text[i];
        el.dispatchEvent(evt);
        await delay(100 + Math.random() * 50);
      }
    }
  }

  /* -----------------------------
   * 4) Handling user-chosen interaction
   * ----------------------------- */
  async function handlePerformInteraction() {
    // 1) Find the item in our domItems array
    const item = domItems.find((d) => d.id === Number(selectedItemId));
    if (!item) {
      alert("Invalid item selected.");
      return;
    }

    // 2) Start automation mode (fake cursor)
    startAutomation();
    setCursorMode("pointer");

    try {
      // 3) Scroll it into view and animate to it
      const el = findActualElementById(item.id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

      // Wait a bit for scroll
      await delay(500);

      // Animate cursor to the center of item
      const targetX = item.x + item.width / 2;
      const targetY = item.y + item.height / 2;
      await animateCursorTo(targetX, targetY);

      // 4) Depending on the interaction type, do the action
      switch (selectedInteraction) {
        case InteractionType.CLICK:
          setCursorMode("hand");
          if (el) clickElement(el);
          break;

        case InteractionType.TYPE:
          setCursorMode("text");
          if (el) await typeInElement(el, interactionText);
          break;

        case InteractionType.DRAG:
          // 1) "MouseDown" on item
          if (el) el.dispatchEvent(new Event("mousedown", { bubbles: true }));
          setCursorMode("hand");
          // 2) Move to final coordinate
          await animateCursorTo(dragTargetCoordinate.x, dragTargetCoordinate.y);
          // 3) "MouseUp"
          if (el) el.dispatchEvent(new Event("mouseup", { bubbles: true }));
          break;

        default:
          console.warn("Unknown interaction type");
      }
    } catch (error) {
      console.error("Interaction error:", error);
    }

    // 5) Stop automation mode
    stopAutomation();

    // 6) After the DOM changes, re-parse for an updated JSON
    buildDomSnapshot();
  }

  // Find the actual DOM element by matching bounding rect, tag name, etc.
  // For simplicity, let's approximate by ID in our array; we just re-query
  // everything and find the nth "parsed" item. Or you can store references
  // in a map. We'll do a simpler approach here:
  function findActualElementById(id) {
    let indexInDomItems = domItems.findIndex((d) => d.id === id);
    if (indexInDomItems === -1) return null;

    // Because the order was based on the querySelectorAll, let's do that again:
    const allElements = Array.from(document.querySelectorAll("body *")).filter(
      (el) => !el.classList.contains("fake-cursor")
    );
    if (allElements[indexInDomItems]) {
      return allElements[indexInDomItems];
    }
    return null;
  }

  /* -----------------------------
   * Normal UI event handlers
   * ----------------------------- */
  function handleSearchChange(e) {
    setSearchValue(e.target.value);
  }
  function handleSearchClick() {
    console.log("Searching for:", searchValue);
    // In a real app, do something with this...
  }
  function handleBuy(itemName) {
    alert(`Buying "${itemName}"... (mocked)`);
  }

  /* -----------------------------
   * Render
   * ----------------------------- */
  return (
    <div className="app-container">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="brand">MegaStore</div>
        <div className="search-section">
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
      {/* Hide the real cursor while automating */}
      <style>{isAutomating ? `body { cursor: none !important; }` : ""}</style>

      {/* 5) User Interaction Control Panel */}
      <div className="interaction-panel">
        <h3>DOM Snapshot (JSON)</h3>
        <pre className="json-output">{JSON.stringify(domItems, null, 2)}</pre>

        <div className="interaction-form">
          <label>
            Target Item ID:
            <input
              type="number"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              style={{ width: "60px", marginLeft: "8px" }}
            />
          </label>

          <label>
            Interaction:
            <select
              value={selectedInteraction}
              onChange={(e) => setSelectedInteraction(e.target.value)}
            >
              <option value={InteractionType.CLICK}>Click</option>
              <option value={InteractionType.TYPE}>Type</option>
              <option value={InteractionType.DRAG}>Drag</option>
            </select>
          </label>

          {/* If typing, show an input for text */}
          {selectedInteraction === InteractionType.TYPE && (
            <label>
              Text to Type:
              <input
                type="text"
                value={interactionText}
                onChange={(e) => setInteractionText(e.target.value)}
                style={{ marginLeft: "8px" }}
              />
            </label>
          )}

          {/* If dragging, show target coordinate fields */}
          {selectedInteraction === InteractionType.DRAG && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <label>
                Target X:
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
                Target Y:
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
          )}

          <button onClick={handlePerformInteraction}>Perform Action</button>
        </div>
      </div>
    </div>
  );
}
