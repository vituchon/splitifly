const CACHE_NAME = "splitifly-cache-v2";
const ASSETS_TO_CACHE = [
  "/assets/html/index.html",
  "/assets/html/about.html",
  "/assets/css/main.css",
  "/assets/js/app/app.js",
  "/assets/js/app/index.js",
  "/assets/js/model/api/api.js",
  "/assets/js/model/group.js",
  "/assets/js/model/movement.js",
  "/assets/js/model/price.js",
  "/assets/js/repositories/common.js",
  "/assets/js/repositories/entity_memory_storage.js",
  "/assets/js/repositories/movements_memory_storage.js",
  "/assets/js/repositories/participant-movements-memory-storage.js",
  "/assets/js/repositories/participants_memory_storage.js",
  "/assets/js/util/big-fraction.js",
  "/assets/js/util/fraction.js",
  "/assets/js/util/number.js",
  "/assets/images/catty.jpg",
  "/assets/images/worker.jpeg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});
