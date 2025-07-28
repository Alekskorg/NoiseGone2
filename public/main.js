// Ждём полной загрузки DOM
document.addEventListener("DOMContentLoaded", function () {
    // Клик по надписи открывает выбор файла
    document.getElementById("dropText").onclick = function () {
        document.getElementById("fileInput").click();
    };

    // После выбора файла — алерт с именем
    document.getElementById("fileInput").onchange = function (e) {
        if (e.target.files.length) {
            alert("Файл выбран: " + e.target.files[0].name);
        }
    };
});


