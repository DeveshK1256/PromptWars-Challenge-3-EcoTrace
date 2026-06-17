/**
 * @module data-challenges
 * Static challenge and badge data for EcoTrace gamification.
 */

/**
 * Weekly / monthly eco-challenges users can accept.
 *
 * @type {Array<{
 *   id: string,
 *   title: string,
 *   description: string,
 *   points: number,
 *   deadline: string,
 *   category: string,
 *   icon: string
 * }>}
 */
export const CHALLENGES = [
  {
    id: "car-free-3",
    title: "Go car-free for 3 days",
    description: "Use walking, cycling, public transport, or ride-sharing for three days this week.",
    points: 50,
    deadline: "Sunday 8 PM",
    category: "Transport",
    icon: "fa-person-walking",
  },
  {
    id: "vegetarian-week",
    title: "Eat vegetarian this week",
    description: "Choose vegetarian meals for seven days and log one recipe that worked for you.",
    points: 40,
    deadline: "Friday midnight",
    category: "Food",
    icon: "fa-carrot",
  },
  {
    id: "unplug-devices",
    title: "Unplug devices when not in use",
    description: "Switch off standby devices, chargers, and unused appliances for the full week.",
    points: 20,
    deadline: "Daily check-in",
    category: "Energy",
    icon: "fa-plug-circle-bolt",
  },
  {
    id: "plant-a-tree",
    title: "Plant a tree",
    description: "Plant or sponsor a native tree and add the proof to your activity log.",
    points: 100,
    deadline: "This month",
    category: "Community",
    icon: "fa-tree",
  },
];

/**
 * Gamification badges awarded when a user's total eco-points reach a threshold.
 *
 * @type {Array<{
 *   id: string,
 *   label: string,
 *   icon: string,
 *   threshold: number
 * }>}
 */
export const BADGES = [
  { id: "seedling", label: "Seedling", icon: "🌱", threshold: 25 },
  { id: "starter", label: "Eco Starter", icon: "🌿", threshold: 100 },
  { id: "guardian", label: "Tree Guardian", icon: "🌳", threshold: 250 },
  { id: "defender", label: "Earth Defender", icon: "🌍", threshold: 500 },
];
