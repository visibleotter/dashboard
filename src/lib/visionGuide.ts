/*
  Vision guide content (Russian).

  Single source of truth for the /vision page. Add or edit sections here — the
  page will pick them up automatically. The structure intentionally mirrors a
  typical industrial 3D-vision documentation outline so you can fill it in
  topic by topic without rewiring the UI.

  Conventions:
    - id          stable slug used as the anchor and TOC key (latin, kebab-case).
    - title       Russian heading shown in the TOC and at the top of the card.
    - intro       short Russian paragraph rendered under the chapter title.
    - sections    collapsible subsections. body supports paragraphs split by \n\n
                  and bullet lists where each line starts with "- ".
*/

export interface VisionSubsection {
  id: string;
  title: string;
  body: string;
}

export interface VisionChapter {
  id: string;
  title: string;
  intro?: string;
  sections: VisionSubsection[];
}

const placeholder = (lines: string[]) =>
  "Заполните этот раздел. Что здесь обычно описывают:\n\n" +
  lines.map((l) => `- ${l}`).join("\n");

export const VISION_CHAPTERS: VisionChapter[] = [
  {
    id: "intro",
    title: "1. Введение",
    intro:
      "Краткий обзор системы технического зрения: для чего она нужна, какие задачи решает и как встроена в общий процесс производства.",
    sections: [
      {
        id: "intro-overview",
        title: "Что такое 3D-система технического зрения",
        body: placeholder([
          "Определение и назначение системы.",
          "Основные компоненты: 3D-камера, ПО обработки, контроллер робота.",
          "Чем отличается от обычного 2D-зрения и где применяется именно 3D.",
        ]),
      },
      {
        id: "intro-use-cases",
        title: "Области применения",
        body: placeholder([
          "Bin picking (захват хаотично расположенных деталей).",
          "Палетизация и депалетизация.",
          "Контроль качества и измерения.",
          "Сборка и позиционирование.",
        ]),
      },
      {
        id: "intro-architecture",
        title: "Архитектура решения",
        body: placeholder([
          "Схема: камера → сервер обработки → робот.",
          "Сетевой обмен (Ethernet/IP, TCP/IP, OPC UA).",
          "Кто за что отвечает: данные, логика, движение.",
        ]),
      },
    ],
  },
  {
    id: "hardware",
    title: "2. Аппаратное обеспечение",
    intro: "Состав оборудования, требования к монтажу и подключению.",
    sections: [
      {
        id: "hardware-camera",
        title: "3D-камера: модели и характеристики",
        body: placeholder([
          "Какие модели камер используются (ссылки на даташиты).",
          "Рабочая дистанция, точность, поле зрения.",
          "Интерфейсы (GigE / USB3) и питание.",
        ]),
      },
      {
        id: "hardware-mounting",
        title: "Монтаж камеры",
        body: placeholder([
          "Варианты крепления: стационарно над сценой, на TCP робота (Eye-in-Hand).",
          "Жёсткость кронштейна и виброизоляция.",
          "Углы наклона и оптимальное расстояние до сцены.",
        ]),
      },
      {
        id: "hardware-lighting",
        title: "Освещение и условия эксплуатации",
        body: placeholder([
          "Требования к внешней засветке.",
          "Поведение системы при отражениях, тенях, бликах.",
          "Температура и влажность в рабочей зоне.",
        ]),
      },
      {
        id: "hardware-network",
        title: "Сетевое подключение",
        body: placeholder([
          "Топология сети (камера ↔ сервер ↔ робот).",
          "IP-адресация, MTU, jumbo frames.",
          "Безопасность: VLAN, firewall, доступ извне.",
        ]),
      },
    ],
  },
  {
    id: "software",
    title: "3. Установка ПО",
    intro:
      "Подготовка рабочего ПК или промышленного контроллера к запуску системы зрения.",
    sections: [
      {
        id: "software-requirements",
        title: "Системные требования",
        body: placeholder([
          "ОС, версия драйверов GPU/сетевой карты.",
          "Минимум по CPU/RAM/GPU/диску.",
          "Поддерживаемые версии Windows / Linux.",
        ]),
      },
      {
        id: "software-install",
        title: "Установка драйверов и ПО",
        body: placeholder([
          "Дистрибутивы и лицензии.",
          "Пошаговая установка драйвера камеры.",
          "Проверка подключения после установки.",
        ]),
      },
      {
        id: "software-first-run",
        title: "Первый запуск",
        body: placeholder([
          "Как открыть приложение, авторизоваться, выбрать проект.",
          "Базовая проверка: получение пробного изображения.",
          "Сохранение и резервное копирование настроек.",
        ]),
      },
    ],
  },
  {
    id: "calibration",
    title: "4. Калибровка",
    intro:
      "Без корректной калибровки координаты, которые система отдаёт роботу, будут смещены. Это самый ответственный этап.",
    sections: [
      {
        id: "calibration-intrinsic",
        title: "Внутренняя калибровка камеры (intrinsic)",
        body: placeholder([
          "Что такое внутренние параметры (focal length, principal point, distortion).",
          "Калибровочные мишени (chessboard, circle grid).",
          "Сколько кадров нужно и под какими углами.",
        ]),
      },
      {
        id: "calibration-handeye",
        title: "Hand-Eye калибровка (между камерой и роботом)",
        body: placeholder([
          "Разница между Eye-in-Hand и Eye-to-Hand.",
          "Подготовка: фиксация мишени, выбор поз робота.",
          "Запуск процедуры и интерпретация погрешности.",
        ]),
      },
      {
        id: "calibration-validation",
        title: "Проверка калибровки",
        body: placeholder([
          "Эталонные тесты: касание точки, многоточечный тест.",
          "Допустимые отклонения по X/Y/Z и углам.",
          "Когда нужно перекалибровать.",
        ]),
      },
    ],
  },
  {
    id: "pointcloud",
    title: "5. Захват и обработка облака точек",
    intro:
      "Как из «сырых» данных камеры получается чистое, пригодное для распознавания облако точек.",
    sections: [
      {
        id: "pc-capture",
        title: "Захват облака",
        body: placeholder([
          "Параметры экспозиции и количества кадров.",
          "Триггер: программный, аппаратный, по таймеру.",
          "Сохранение для отладки (формат, размер, скорость).",
        ]),
      },
      {
        id: "pc-filtering",
        title: "Фильтрация шумов и outlier-ов",
        body: placeholder([
          "Voxel downsampling.",
          "Статистические и радиус-фильтры outlier-ов.",
          "Удаление плоскости стола / контейнера.",
        ]),
      },
      {
        id: "pc-segmentation",
        title: "Сегментация сцены",
        body: placeholder([
          "Разделение объектов между собой.",
          "Использование цвета, нормалей, кластеризации.",
          "Что делать при касающихся / штабелированных деталях.",
        ]),
      },
    ],
  },
  {
    id: "recognition",
    title: "6. Распознавание и локализация объектов",
    intro:
      "Конечная задача — определить позу (6DoF) каждой детали в системе координат робота.",
    sections: [
      {
        id: "rec-template",
        title: "Эталонная модель детали",
        body: placeholder([
          "Откуда брать CAD-модель / сканировать эталон.",
          "Подготовка модели: чистка, упрощение mesh.",
          "Версионирование моделей и хранение.",
        ]),
      },
      {
        id: "rec-matching",
        title: "Сопоставление с моделью",
        body: placeholder([
          "Алгоритмы: ICP, feature matching, AI-сегментация.",
          "Параметры точности и времени.",
          "Что менять, если деталь часто не распознаётся.",
        ]),
      },
      {
        id: "rec-pose",
        title: "Расчёт позы захвата",
        body: placeholder([
          "Выбор точки и направления захвата.",
          "Проверка коллизий с соседними деталями.",
          "Сортировка кандидатов по уверенности и доступности.",
        ]),
      },
    ],
  },
  {
    id: "integration",
    title: "7. Интеграция с роботом",
    intro: "Передача данных в контроллер робота и согласование движений.",
    sections: [
      {
        id: "int-protocols",
        title: "Поддерживаемые контроллеры и протоколы",
        body: placeholder([
          "Список контроллеров (KUKA / Fanuc / UR / ABB / другие).",
          "Используемые протоколы (TCP/IP, Ethernet/IP, OPC UA, Modbus).",
          "Пример обмена сообщениями.",
        ]),
      },
      {
        id: "int-coordinates",
        title: "Передача координат",
        body: placeholder([
          "Формат сообщения: X, Y, Z, A, B, C.",
          "Единицы измерения (мм / м, градусы / радианы).",
          "Опорная система координат (база робота, инструмент, мировая).",
        ]),
      },
      {
        id: "int-pickplace",
        title: "Pick & Place цикл",
        body: placeholder([
          "Сценарий цикла: запрос → захват → подтверждение → новый запрос.",
          "Обработка случаев «деталей нет», «не получилось взять», «коллизия».",
          "Тайминги и пропускная способность.",
        ]),
      },
    ],
  },
  {
    id: "debug",
    title: "8. Отладка и диагностика",
    intro: "Как понять, что пошло не так, и где смотреть.",
    sections: [
      {
        id: "debug-quality",
        title: "Качество облака точек",
        body: placeholder([
          "Признаки плохого облака: разрывы, выпадение поверхностей.",
          "Что менять: освещение, экспозиция, угол.",
          "Скриншоты «плохо vs хорошо» для сравнения.",
        ]),
      },
      {
        id: "debug-calibration",
        title: "Ошибки калибровки",
        body: placeholder([
          "Симптомы: систематический сдвиг, поворот всей сцены.",
          "Как читать отчёт калибровки.",
          "Когда повторять полностью, когда — только Hand-Eye.",
        ]),
      },
      {
        id: "debug-logs",
        title: "Логи и метрики",
        body: placeholder([
          "Где лежат логи, как их собрать для отправки в поддержку.",
          "Ключевые метрики (частота, латентность, success rate).",
          "Сбор статистики по сменам.",
        ]),
      },
    ],
  },
  {
    id: "faq",
    title: "9. Частые вопросы",
    intro: "Короткие ответы на ситуации, которые повторяются чаще всего.",
    sections: [
      {
        id: "faq-noresult",
        title: "Система не находит деталь — что проверить?",
        body: placeholder([
          "Освещение и засветку.",
          "Состояние эталонной модели.",
          "Параметры порогов распознавания.",
        ]),
      },
      {
        id: "faq-precision",
        title: "Точность ниже заявленной — куда смотреть?",
        body: placeholder([
          "Калибровка.",
          "Жёсткость крепления камеры.",
          "Температура и прогрев.",
        ]),
      },
      {
        id: "faq-update",
        title: "Как обновить ПО без остановки производства?",
        body: placeholder([
          "План обновления.",
          "Тестовая среда / staging.",
          "Откат к предыдущей версии.",
        ]),
      },
    ],
  },
];
