/* MX Tycoon - global constants shared by simulation, rendering and UI. */
(function (MX) {
  'use strict';
  MX.C = {
    TILE: 4,              // metres per tile
    MAP: 80,              // tiles per side (320 m x 320 m)
    PARCEL: 8,            // tiles per land parcel side
    DAY_SEC: 30,          // real seconds per in-game day at x1
    MONTH_DAYS: 28,       // four weeks per month keeps weekdays aligned
    START_MONTH: 2,       // March, like the classics
    START_MONEY: 150000,
    SANDBOX_MONEY: 5000000,
    BANKRUPT_LIMIT: -25000,
    BANKRUPT_DAYS: 28,
    WATER_LEVEL: 3.0,
    BASE_HEIGHT: 6.0,
    MIN_HEIGHT: 0.0,
    MAX_HEIGHT: 80.0,
    HEIGHT_STEP: 0.5,
    G: 9.81,
    TRACK_DS: 0.5,        // physics sampling of the track centreline (m)
    TRACK_RDS: 1.0,       // render sampling (m)
    MIN_TRACK_LEN: 250,
    MAX_TRACK_LEN: 2600,
    MIN_RADIUS: 4.0,
    MAX_SLOPE: 0.55,
    SPEEDS: [0, 1, 2, 4, 8],
    MAX_VISITORS: 650,
    MAX_RIDERS: 90,
    MAX_CARS: 220,
    TERRAIN_COST: 18,     // € per vertex-metre moved
    TREE_CLEAR_COST: 60,
    THEME_ZONE: 3,        // pieces of one decoration pack near a track that make a themed zone
    PAINT_COST: 8,
    REFUND_RATE: 0.5,
    LOAN_STEP: 10000,
    LOAN_RATE_YEAR: 0.065,
    SAVE_VERSION: 1
  };
})(window.MX);
