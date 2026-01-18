document.addEventListener('DOMContentLoaded', (event) => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        DarkReader.setFetchMethod(window.fetch);
        DarkReader.enable({
            brightness: 100,
            contrast: 100,
            sepia: 0,
            scheme: 'dark'
        });
    }else{
        DarkReader.disable()
    }
});
