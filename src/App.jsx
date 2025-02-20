import React, { useEffect, useState } from "react";
import "./App.css";

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

export default function App() {
  //
  // State / Refs
  //
  const [isAutomating, setIsAutomating] = useState(false);

  // The fake cursor’s position on screen
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // The user’s real mouse position (tracked continuously when not automating).
  const [realMousePos, setRealMousePos] = useState({ x: 0, y: 0 });

  // The fake “search query” typed into the search bar
  const [searchValue, setSearchValue] = useState("");

  //
  // Effects
  //

  // 1) Track the user's real mouse location
  //    We only do this while NOT automating, so we don’t overwrite the fake cursor’s pos.
  useEffect(() => {
    function handleMouseMove(e) {
      if (!isAutomating) {
        setRealMousePos({ x: e.clientX, y: e.clientY });
      }
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isAutomating]);

  // 2) Listen for keydown “A” to start automation
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key.toLowerCase() === "a" && !isAutomating) {
        startAutomation();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAutomating]);

  //
  // Automation Logic
  //

  async function startAutomation() {
    // On start, place the fake cursor exactly where the user’s real mouse is
    setCursorPos(realMousePos);
    setIsAutomating(true);

    try {
      // Step 1: Move to Search Input, click, type
      const searchInput = document.querySelector(".search-input");
      if (searchInput) {
        await moveFakeCursorToElement(searchInput);
        clickElement(searchInput);
        await typeInSearchInput("Nice Shoes");
      }

      // Step 2: Move to "Search" button, click
      const searchButton = document.querySelector(".search-button");
      if (searchButton) {
        await moveFakeCursorToElement(searchButton);
        clickElement(searchButton);
      }

      // Step 3: Scroll down and buy item #2
      const secondProductBuyBtn = document.querySelectorAll(".buy-btn")[1];
      if (secondProductBuyBtn) {
        await moveFakeCursorToElement(secondProductBuyBtn, true);
        clickElement(secondProductBuyBtn);
        alert("Proceeding to checkout for Item #2!");
      }
    } catch (err) {
      console.error("Automation error:", err);
    }

    stopAutomation();
  }

  function stopAutomation() {
    setIsAutomating(false);
  }

  // Simulate typing text, character by character
  async function typeInSearchInput(text) {
    for (let i = 0; i < text.length; i++) {
      setSearchValue((prev) => prev + text[i]);
      await delay(120 + Math.random() * 80);
    }
  }

  // Actually clicks an element in the DOM
  function clickElement(el) {
    el.click();
  }

  // Move the fake cursor from its current position to a DOM element.
  // Optionally scroll the element into view first.
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

  // Animate the fake cursor from (startX, startY) -> (endX, endY)
  function animateCursor(startX, startY, endX, endY, speed, onDone) {
    let currentX = startX;
    let currentY = startY;

    function step() {
      const dx = endX - currentX;
      const dy = endY - currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < speed) {
        // Close enough; snap to final
        setCursorPos({ x: endX, y: endY });
        if (onDone) onDone();
      } else {
        // Move a little closer
        const angle = Math.atan2(dy, dx);
        currentX += speed * Math.cos(angle);
        currentY += speed * Math.sin(angle);
        setCursorPos({ x: currentX, y: currentY });
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  //
  // Handlers for normal UI (search, buy, etc.)
  //
  function handleSearchChange(e) {
    setSearchValue(e.target.value);
  }
  function handleSearchClick() {
    console.log("Searching for:", searchValue);
    // In a real app, you'd query a backend or filter products...
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
              src="https://fastly.picsum.photos/id/175/2896/1944.jpg?hmac=djMSfAvFgWLJ2J3cBulHUAb4yvsQk0d4m4xBJFKzZrs"
              alt="Item #1"
            />
            <h3>Item #1</h3>
            <p>Antique Clock</p>
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
              src="https://fastly.picsum.photos/id/39/3456/2304.jpg?hmac=cc_VPxzydwTUbGEtpsDeo2NxCkeYQrhTLqw4TFo-dIg"
              alt="Item #3"
            />
            <h3>Item #3</h3>
            <p>Record Player</p>
            <button className="buy-btn" onClick={() => handleBuy("Item #3")}>
              Buy Now
            </button>
          </div>
        </div>
      </main>

      {/* FAKE CURSOR */}
      {isAutomating && (
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/d/da/Aero_arrow_xl.png"
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
