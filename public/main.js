document.getElementById("dropText").onclick = function () {
    document.getElementById("fileInput").click();
};

document.getElementById("fileInput").onchange = function (e) {
    if (e.target.files.length) {
        alert("Файл выбран: " + e.target.files[0].name);
    }
};






