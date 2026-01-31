document.addEventListener('DOMContentLoaded', (event) => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        DarkReader.setFetchMethod(window.fetch);
        DarkReader.enable({
            brightness: 100,
            contrast: 100,
            sepia: 0,
            scheme: 'dark'
        });

        // Add a global style safely inside the head to prevent inversions
        const style = document.createElement('style');
        style.textContent = `
            .mermaid, .mermaid *, svg.mermaid-svg, svg.mermaid-svg * {
                filter: none !important;
                -webkit-filter: none !important;
            }
        `;
        document.head.appendChild(style);
    } else {
        DarkReader.disable()
    }
});
