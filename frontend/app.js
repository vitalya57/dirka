const API_URL = 'https://empowering-prosperity-production-8afe.up.railway.app';

let map;
let userToken = null;
let userName = null;
let selectedCoords = null;

document.getElementById('btnRegister').onclick = register;
document.getElementById('btnLogin').onclick = login;
document.getElementById('logoutBtn').onclick = logout;
document.getElementById('closeCommentFormBtn').onclick = () => toggleCommentForm(false);
document.getElementById('addCommentBtn').onclick = (event) => {
    event.preventDefault();
    addComment();
};

// Добавляем слушатель событий для input[type="file"] для предпросмотра
document.getElementById('commentImage').addEventListener('change', function(event) {
    clearImagePreview(); // Очищаем предыдущий предпросмотр
    const files = event.target.files;
    const previewContainer = document.getElementById('selectedImagesPreview');

    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.style.width = '50px'; // Миниатюра для предпросмотра
                img.style.height = '50px';
                img.style.objectFit = 'cover';
                img.style.marginRight = '5px';
                img.onload = () => URL.revokeObjectURL(img.src); // Освобождаем память
                previewContainer.appendChild(img);
            }
        }
    }
});


function showAuthError(text) {
    document.getElementById('authError').innerText = text;
}

function register() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!username || !password) return showAuthError('Введите имя и пароль');

    fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    }).then(res => res.json())
        .then(data => {
            if (data.error) showAuthError(data.error);
            else showAuthError('Регистрация успешна, войдите');
        });
}

function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!username || !password) return showAuthError('Введите имя и пароль');

    fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    }).then(res => res.json())
        .then(data => {
            if (data.error) showAuthError(data.error);
            else {
                userToken = data.token;
                userName = data.username;
                initApp();
            }
        });
}

function logout() {
    userToken = null;
    userName = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('auth').style.display = 'block';
    clearCommentsList();
    if (map) map.destroy();
}

function initApp() {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    ymaps.ready(() => {
        map = new ymaps.Map('map', {
            center: [47.235713, 39.701505],
            zoom: 12
        });

        map.events.add('click', e => {
            selectedCoords = e.get('coords');
            toggleCommentForm(true);
        });

        loadComments();
    });
}

// Новая функция для очистки предпросмотра изображений
function clearImagePreview() {
    const previewContainer = document.getElementById('selectedImagesPreview');
    previewContainer.innerHTML = ''; // Очищаем контейнер
}

function toggleCommentForm(show) {
    const form = document.getElementById('commentForm');
    form.style.display = show ? 'block' : 'none';
    if (!show) {
        document.getElementById('commentText').value = '';
        document.getElementById('commentImage').value = ''; // Сбрасываем выбранные файлы
        clearImagePreview(); // Очищаем предпросмотр
        selectedCoords = null;
    }
}

async function addComment() {
    const text = document.getElementById('commentText').value.trim();
    // Теперь получаем все выбранные файлы
    const imageFiles = document.getElementById('commentImage').files; // Это FileList
    if (!text || !selectedCoords) return;

    const formData = new FormData();
    formData.append('text', text);
    formData.append('coords', JSON.stringify(selectedCoords));

    // Добавляем каждый файл под одним и тем же именем 'images'
    // На бэкенде multer будет ожидать массив
    for (let i = 0; i < imageFiles.length; i++) {
        formData.append('images', imageFiles[i]);
    }

    const res = await fetch(`${API_URL}/comments`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${userToken}`
            // 'Content-Type' не устанавливаем, FormData сама установит правильный boundary
        },
        body: formData
    });

    if (res.ok) {
        const comment = await res.json();
        addCommentToList(comment);
        addPlacemark(comment);
        toggleCommentForm(false);
    } else {
        const err = await res.json();
        alert(err.error || 'Ошибка при добавлении');
    }
}

function loadComments() {
    fetch(`${API_URL}/comments`)
        .then(res => res.json())
        .then(comments => {
            comments.forEach(addPlacemark);
            comments.forEach(addCommentToList);
        });
}

// Обнови функцию addPlacemark, чтобы она могла обрабатывать массив URL-ов
function addPlacemark(comment) {
    const coords = Array.isArray(comment.coords) ? comment.coords : JSON.parse(comment.coords);

    let balloonContent = `<b>${comment.username}</b><br>${comment.text}`;

    // Проверяем, есть ли изображения и добавляем их в балун
    if (comment.imageUrls && comment.imageUrls.length > 0) {
        comment.imageUrls.forEach(url => {
            balloonContent += `<br><img src="${API_URL}${url}" width="100" style="margin-top: 5px;"/>`;
        });
    }

    const placemark = new ymaps.Placemark(coords, {
        balloonContent: balloonContent
    }, {
        preset: 'islands#dotIcon',
        visible: map.getZoom() > 12
    });

    map.geoObjects.add(placemark);

    map.events.add('boundschange', () => {
        const visible = map.getZoom() > 12;
        placemark.options.set('visible', visible);
    });
}


function addCommentToList(comment) {
    console.log('Добавлен комментарий:', comment);

    const ul = document.getElementById('commentsList');
    const li = document.createElement('li');

    let imageHtml = '';
    // Проверяем, есть ли изображения и их количество
    if (comment.imageUrls && comment.imageUrls.length > 0) {
        const numImages = comment.imageUrls.length;
        // Создаем кнопку/ссылку для отображения фото
        imageHtml = `
            <span class="image-toggle" style="cursor: pointer; color: blue; text-decoration: underline;">
                (фото: ${numImages})
            </span>
            <div class="image-gallery" style="display: none; margin-top: 5px;">
                ${comment.imageUrls.map(url => `<img src="${API_URL}${url}" width="100" style="margin-right: 5px; margin-bottom: 5px;"/>`).join('')}
            </div>
        `;
    }

    li.innerHTML = `
        <b>${comment.username}</b>: ${comment.text}
        ${imageHtml}
        <br><button class="gotoBtn">Перейти</button>
        <button class="deleteBtn" data-id="${comment._id}">Удалить</button>
    `;

    const coords = Array.isArray(comment.coords) ? comment.coords : JSON.parse(comment.coords);

    li.querySelector('.gotoBtn').onclick = () => {
        map.setCenter(coords, 15, { duration: 500 });
    };

    // Добавляем обработчик для кнопки "фото"
    const imageToggle = li.querySelector('.image-toggle');
    if (imageToggle) {
        imageToggle.onclick = function() {
            const gallery = this.nextElementSibling; // Следующий элемент - это галерея
            if (gallery.style.display === 'none') {
                gallery.style.display = 'block';
            } else {
                gallery.style.display = 'none';
            }
        };
    }

    const delBtn = li.querySelector('.deleteBtn');
    if (comment.username !== userName) delBtn.style.display = 'none';
    delBtn.onclick = async (e) => {
        e.stopPropagation();
        // Внимание: при удалении комментария, возможно, стоит удалять и файлы
        // Это нужно реализовать на бэкенде. (Это уже сделано в предыдущем ответе для backend/comments.js)
        await fetch(`${API_URL}/comments/${comment._id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        clearCommentsList();
        loadComments();
    };

    ul.appendChild(li);
}

function clearCommentsList() {
    document.getElementById('commentsList').innerHTML = '';
}
