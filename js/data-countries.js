/**
 * @module data-countries
 * Historical country-level CO₂ emission figures used by the comparative
 * emissions bar chart. Separated from the main data module to keep large
 * static datasets in their own file.
 */

/**
 * Available years for the country-emissions chart slider.
 *
 * @type {number[]}
 */
export const COUNTRY_EMISSIONS_YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

/**
 * Annual CO₂ emissions (in Mt CO₂) for the top 15 emitting countries,
 * keyed by year. Used to render the comparative emissions bar chart.
 *
 * @type {Object<number, Array<{ country: string, flag: string, emissions: number }>>}
 */
export const COUNTRY_EMISSIONS = {
  2020: [
    { country: "China", flag: "🇨🇳", emissions: 10668 },
    { country: "United States", flag: "🇺🇸", emissions: 4326 },
    { country: "India", flag: "🇮🇳", emissions: 2442 },
    { country: "Russia", flag: "🇷🇺", emissions: 1580 },
    { country: "Japan", flag: "🇯🇵", emissions: 1031 },
    { country: "Iran", flag: "🇮🇷", emissions: 690 },
    { country: "Germany", flag: "🇩🇪", emissions: 604 },
    { country: "South Korea", flag: "🇰🇷", emissions: 586 },
    { country: "Saudi Arabia", flag: "🇸🇦", emissions: 568 },
    { country: "Indonesia", flag: "🇮🇩", emissions: 568 },
    { country: "Canada", flag: "🇨🇦", emissions: 521 },
    { country: "Brazil", flag: "🇧🇷", emissions: 434 },
    { country: "South Africa", flag: "🇿🇦", emissions: 430 },
    { country: "Turkey", flag: "🇹🇷", emissions: 393 },
    { country: "Mexico", flag: "🇲🇽", emissions: 370 },
  ],
  2021: [
    { country: "China", flag: "🇨🇳", emissions: 11472 },
    { country: "United States", flag: "🇺🇸", emissions: 4595 },
    { country: "India", flag: "🇮🇳", emissions: 2647 },
    { country: "Russia", flag: "🇷🇺", emissions: 1757 },
    { country: "Japan", flag: "🇯🇵", emissions: 1064 },
    { country: "Iran", flag: "🇮🇷", emissions: 712 },
    { country: "Germany", flag: "🇩🇪", emissions: 637 },
    { country: "South Korea", flag: "🇰🇷", emissions: 611 },
    { country: "Saudi Arabia", flag: "🇸🇦", emissions: 583 },
    { country: "Indonesia", flag: "🇮🇩", emissions: 583 },
    { country: "Canada", flag: "🇨🇦", emissions: 548 },
    { country: "Brazil", flag: "🇧🇷", emissions: 457 },
    { country: "South Africa", flag: "🇿🇦", emissions: 440 },
    { country: "Turkey", flag: "🇹🇷", emissions: 430 },
    { country: "Mexico", flag: "🇲🇽", emissions: 386 },
  ],
  2022: [
    { country: "China", flag: "🇨🇳", emissions: 11397 },
    { country: "United States", flag: "🇺🇸", emissions: 4622 },
    { country: "India", flag: "🇮🇳", emissions: 2830 },
    { country: "Russia", flag: "🇷🇺", emissions: 1696 },
    { country: "Japan", flag: "🇯🇵", emissions: 1017 },
    { country: "Iran", flag: "🇮🇷", emissions: 740 },
    { country: "Indonesia", flag: "🇮🇩", emissions: 615 },
    { country: "Germany", flag: "🇩🇪", emissions: 613 },
    { country: "Saudi Arabia", flag: "🇸🇦", emissions: 600 },
    { country: "South Korea", flag: "🇰🇷", emissions: 594 },
    { country: "Canada", flag: "🇨🇦", emissions: 541 },
    { country: "Brazil", flag: "🇧🇷", emissions: 467 },
    { country: "South Africa", flag: "🇿🇦", emissions: 435 },
    { country: "Turkey", flag: "🇹🇷", emissions: 420 },
    { country: "Mexico", flag: "🇲🇽", emissions: 391 },
  ],
  2023: [
    { country: "China", flag: "🇨🇳", emissions: 11859 },
    { country: "United States", flag: "🇺🇸", emissions: 4607 },
    { country: "India", flag: "🇮🇳", emissions: 3025 },
    { country: "Russia", flag: "🇷🇺", emissions: 1764 },
    { country: "Japan", flag: "🇯🇵", emissions: 994 },
    { country: "Iran", flag: "🇮🇷", emissions: 756 },
    { country: "Indonesia", flag: "🇮🇩", emissions: 640 },
    { country: "Saudi Arabia", flag: "🇸🇦", emissions: 616 },
    { country: "Germany", flag: "🇩🇪", emissions: 580 },
    { country: "South Korea", flag: "🇰🇷", emissions: 572 },
    { country: "Canada", flag: "🇨🇦", emissions: 530 },
    { country: "Brazil", flag: "🇧🇷", emissions: 480 },
    { country: "South Africa", flag: "🇿🇦", emissions: 429 },
    { country: "Turkey", flag: "🇹🇷", emissions: 415 },
    { country: "Mexico", flag: "🇲🇽", emissions: 395 },
  ],
  2024: [
    { country: "China", flag: "🇨🇳", emissions: 12100 },
    { country: "United States", flag: "🇺🇸", emissions: 4550 },
    { country: "India", flag: "🇮🇳", emissions: 3200 },
    { country: "Russia", flag: "🇷🇺", emissions: 1780 },
    { country: "Japan", flag: "🇯🇵", emissions: 980 },
    { country: "Iran", flag: "🇮🇷", emissions: 770 },
    { country: "Indonesia", flag: "🇮🇩", emissions: 660 },
    { country: "Saudi Arabia", flag: "🇸🇦", emissions: 630 },
    { country: "Germany", flag: "🇩🇪", emissions: 560 },
    { country: "South Korea", flag: "🇰🇷", emissions: 560 },
    { country: "Canada", flag: "🇨🇦", emissions: 525 },
    { country: "Brazil", flag: "🇧🇷", emissions: 490 },
    { country: "Turkey", flag: "🇹🇷", emissions: 425 },
    { country: "South Africa", flag: "🇿🇦", emissions: 425 },
    { country: "Mexico", flag: "🇲🇽", emissions: 400 },
  ],
  2025: [
    { country: "China", flag: "🇨🇳", emissions: 12350 },
    { country: "United States", flag: "🇺🇸", emissions: 4480 },
    { country: "India", flag: "🇮🇳", emissions: 3400 },
    { country: "Russia", flag: "🇷🇺", emissions: 1810 },
    { country: "Japan", flag: "🇯🇵", emissions: 960 },
    { country: "Iran", flag: "🇮🇷", emissions: 785 },
    { country: "Indonesia", flag: "🇮🇩", emissions: 685 },
    { country: "Saudi Arabia", flag: "🇸🇦", emissions: 645 },
    { country: "South Korea", flag: "🇰🇷", emissions: 548 },
    { country: "Germany", flag: "🇩🇪", emissions: 540 },
    { country: "Canada", flag: "🇨🇦", emissions: 518 },
    { country: "Brazil", flag: "🇧🇷", emissions: 502 },
    { country: "Turkey", flag: "🇹🇷", emissions: 432 },
    { country: "South Africa", flag: "🇿🇦", emissions: 418 },
    { country: "Mexico", flag: "🇲🇽", emissions: 408 },
  ],
};
