## **Automation App 🚀**

A fun **React-based automation simulation** that visually mimics user interactions. The app includes a **fake cursor** that moves, types, scrolls, and clicks UI elements as if a human was performing actions.

### **✨ Features**

✅ **Fake Cursor Simulation** – Moves on-screen as if a real user is interacting  
✅ **Automated Workflow** – Search, click buttons, and trigger UI events dynamically  
✅ **Multi-Step UI Interaction** – Simulates a user journey through the interface  
✅ **Realistic UI** – Includes a **navbar**, **search bar**, and **product grid**  
✅ **Full-Screen Layout** – Styled for responsiveness

### **⚡ How to Run Locally**

#### **1. Clone the Repository**

```bash
git clone https://github.com/ajshul/automation-app.git
cd automation-app
```

#### **2. Install Dependencies**

```bash
npm install
```

#### **3. Run the Development Server**

```bash
npm run dev
```

- Open `http://127.0.0.1:5173` in your browser.
- Press **"A"** to start the automation sequence.

### **⌨️ How It Works**

1. **Tracks the real mouse position** before automation begins.
2. **Moves the fake cursor** from its last position.
3. **Finds UI elements via the DOM** (search bar, button, product grid).
4. **Clicks & types dynamically**, as if a user was interacting.
5. **Mimics a real checkout flow**, ending with an alert.

### **🌟 Planned Improvements**

- ⏳ Add more complex UI interactions (drag & drop, form filling, etc.)
- 🎥 Record real-time replay functionality
- 🛠️ Support custom workflows
