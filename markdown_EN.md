Gemini batch question assistant
🚀 This open source project provides a sophisticated Tampermonkey script designed to enhance the productivity of Google Gemini users. It addresses the limitation of the native web interface by allowing users to submit multiple prompts in a single queue. This tool is particularly useful for researchers and developers who need to process large sets of data or queries sequentially without manual intervention.

<img width="1621" height="856" alt="image" src="https://github.com/user-attachments/assets/f8013f9b-c8fc-4729-8263-06a20967632e" />


Key functional features
🌟 The assistant integrates a smart queue management system directly into the Gemini interface. It features an automated status monitor that detects when the AI is busy generating a response or when the system is ready for the next input. To ensure stability and prevent rate limiting, the script includes a configurable cooling mechanism that mimics human typing behavior. Users can manage tasks through an intuitive control panel that supports adding, inserting, or deleting queries at any time during the execution process.

Installation and setup
🔧 To use this tool, first install the Tampermonkey browser extension from the official web store. Navigate to the script file in this repository and click the raw button to prompt an automatic installation. Once installed, the assistant will activate automatically whenever you visit the Google Gemini website. A new list icon will appear in the leading actions wrapper near the input area to provide access to the batch control panel.

Operational guide
📖 Using the script is straightforward and requires no complex configuration. Open the batch panel and enter your multiple queries into the text area using the triple comma delimiter ,,, or ，，， to separate individual questions. This specific separator ensures that standard punctuation within your text does not trigger accidental splits. After populating the list, click the start button to begin the automated process. You can observe the real time status of each task, including pending, processing, and completed states directly within the list view.

Technical architecture
🛠️ The implementation relies on a robust MutationObserver to maintain the interface elements during dynamic page updates. It utilizes a custom input simulation strategy to interact with the Quill editor used by Gemini, ensuring that automated messages are correctly recognized by the platform. The architecture emphasizes modularity and security, keeping all operations local to your browser session without external data tracking.

Open source license
🔓 This project is distributed under the MIT License. Contributions and feedback from the global community are welcome to help refine the automation logic and support more advanced AI interaction workflows.
