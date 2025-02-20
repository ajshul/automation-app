import React, { useEffect, useState } from "react";
import "./App.css";

/**
 * Small helper to simulate waiting N ms.
 */
function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Cursor image URLs for different "modes":
 * - pointer: normal arrow
 * - text: I-beam
 * - hand: hand pointer (often for links/buttons)
 */
const CURSOR_IMAGES = {
  pointer: "src/assets/cursor.svg",
  text: "src/assets/text_cursor.svg",
  hand: "src/assets/click.svg",
};

export default function App() {
  /**
   * Whether we are in "automation" mode.
   */
  const [isAutomating, setIsAutomating] = useState(false);

  /**
   * Fake cursor position (x, y).
   * We'll update this while animating steps.
   */
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  /**
   * Keep track of the user’s real mouse position while NOT automating.
   * Once automation starts, we set the fake cursor to that location.
   */
  const [realMousePos, setRealMousePos] = useState({ x: 0, y: 0 });

  /**
   * Current "mode" of the fake cursor: pointer, text, or hand.
   */
  const [cursorMode, setCursorMode] = useState("pointer");

  /**
   * Example UI state: the typed text in the search bar.
   */
  const [searchValue, setSearchValue] = useState("");

  /* -----------------------------
   * 1) Track user's real mouse position while NOT automating
   * ----------------------------- */
  useEffect(() => {
    function handleMouseMove(e) {
      // Only track if not automating
      if (!isAutomating) {
        setRealMousePos({ x: e.clientX, y: e.clientY });
      }
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isAutomating]);

  /* -----------------------------
   * 2) Listen for "A" key to start automation
   * ----------------------------- */
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key.toLowerCase() === "a" && !isAutomating) {
        startAutomation();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAutomating]);

  /* -----------------------------
   * Start the automation script
   * ----------------------------- */
  async function startAutomation() {
    // Step 0: Place the fake cursor exactly where the real mouse is.
    setCursorPos(realMousePos);
    setIsAutomating(true);

    try {
      // 1) Move to the search input, click it, then type.
      const searchInput = document.querySelector(".search-input");
      if (searchInput) {
        await moveFakeCursorToElement(searchInput);
        // Switch to "hand" when we're about to click
        setCursorMode("hand");
        clickElement(searchInput);

        // Now that we've clicked inside a text field, switch to text cursor
        setCursorMode("text");
        await typeInSearchInput("Nice Shoes");
      }

      // 2) Move to the "Search" button, click.
      const searchButton = document.querySelector(".search-button");
      if (searchButton) {
        // Return to pointer while moving
        setCursorMode("pointer");
        await moveFakeCursorToElement(searchButton);

        // Switch to hand for click
        setCursorMode("hand");
        clickElement(searchButton);
      }

      // 3) Move to the second product's "Buy Now" button
      const secondProduct = document.querySelectorAll(".buy-btn")[1];
      if (secondProduct) {
        // Move as pointer
        setCursorMode("pointer");
        await moveFakeCursorToElement(secondProduct, true);

        // Switch to hand for click
        setCursorMode("hand");
        clickElement(secondProduct);
        alert("Proceeding to checkout for Item #2!");
      }
    } catch (err) {
      console.error("Automation error:", err);
    }

    // End
    stopAutomation();
  }

  function stopAutomation() {
    setIsAutomating(false);
    // Reset cursor mode if you want
    setCursorMode("pointer");
  }

  /* -----------------------------
   * Utility: click a DOM element
   * ----------------------------- */
  function clickElement(el) {
    el.click(); // real DOM click
  }

  /* -----------------------------
   * Utility: Type text into the search input, char by char
   * ----------------------------- */
  async function typeInSearchInput(text) {
    for (let i = 0; i < text.length; i++) {
      setSearchValue((prev) => prev + text[i]);
      await delay(100 + Math.random() * 50);
    }
  }

  /* -----------------------------
   * Utility: Move the fake cursor to an element
   * Optionally scroll into view
   * ----------------------------- */
  function moveFakeCursorToElement(el, scrollIntoView = false) {
    return new Promise((resolve) => {
      if (!el) return resolve();

      if (scrollIntoView) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      const rect = el.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2;
      const targetY = rect.top + rect.height / 2;
      const speed = 8;

      animateCursor(cursorPos.x, cursorPos.y, targetX, targetY, speed, resolve);
    });
  }

  /* -----------------------------
   * Utility: Animate from (startX, startY) to (endX, endY)
   * ----------------------------- */
  function animateCursor(startX, startY, endX, endY, speed, onDone) {
    let currentX = startX;
    let currentY = startY;

    function step() {
      const dx = endX - currentX;
      const dy = endY - currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < speed) {
        // Snap to final
        setCursorPos({ x: endX, y: endY });
        if (onDone) onDone();
      } else {
        const angle = Math.atan2(dy, dx);
        currentX += speed * Math.cos(angle);
        currentY += speed * Math.sin(angle);
        setCursorPos({ x: currentX, y: currentY });
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  /* -----------------------------
   * Normal UI interactions
   * ----------------------------- */
  function handleSearchChange(e) {
    setSearchValue(e.target.value);
  }
  function handleSearchClick() {
    console.log("Searching for:", searchValue);
    // In a real app, you'd do something with this...
  }
  function handleBuy(itemName) {
    alert(`Buying ${itemName}... (mocked)`);
  }

  return (
    <div className="app-container">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="brand">MyStore</div>
        <div className="search-section">
          <input
            className="search-input"
            placeholder="Search..."
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
        <h2>Featured Products</h2>
        <div className="products-grid">
          <div className="product-card">
            <img
              src="https://fastly.picsum.photos/id/39/3456/2304.jpg?hmac=cc_VPxzydwTUbGEtpsDeo2NxCkeYQrhTLqw4TFo-dIg"
              alt="Item #1"
            />
            <h3>Item #1</h3>
            <p>Record Player</p>
            <button className="buy-btn" onClick={() => handleBuy("Item #1")}>
              Buy Now
            </button>
          </div>

          <div className="product-card">
            <img
              src="https://fastly.picsum.photos/id/9/5000/3269.jpg?hmac=cZKbaLeduq7rNB8X-bigYO8bvPIWtT-mh8GRXtU3vPc"
              alt="Item #2"
            />
            <h3>Item #2</h3>
            <p>MacBook Air</p>
            <button className="buy-btn" onClick={() => handleBuy("Item #2")}>
              Buy Now
            </button>
          </div>

          <div className="product-card">
            <img
              src="http://fastly.picsum.photos/id/175/2896/1944.jpg?hmac=djMSfAvFgWLJ2J3cBulHUAb4yvsQk0d4m4xBJFKzZrs"
              alt="Item #3"
            />
            <h3>Item #3</h3>
            <p>Antique Clock</p>
            <button className="buy-btn" onClick={() => handleBuy("Item #3")}>
              Buy Now
            </button>
          </div>
        </div>
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
    </div>
  );
}
