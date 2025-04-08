# Autonomous Agent for Deliveroo.js

This project implements an autonomous software agent for the Deliveroo.js game, capable of perceiving its environment, making decisions, and acting autonomously to collect and deliver parcels. The agent is based on a **Belief-Desire-Intention (BDI)** architecture and supports both **single-agent** and **multi-agent** configurations.

The agent supports two configurable decision-making strategies:

- **BFS-based planning** (fast, deterministic)
- **PDDL-based planning** (flexible, domain-based)

## Project Structure

The project is organized as follows:

- `index.js`: Main entry point to start the agent (single or multi-agent).
- `Config.js`: Configuration file to set parameters like strategy type, session duration, and agent behavior.
- `Agent.js`: Core class that initializes and runs the agent, coordinating all components.
- `AgentInterface.js`: Utility for logging, debugging, and data exporting.

The following folders are inside the `src` folder.
### Environment

- `Environment.js`: Manages the environment map using a matrix representation.
- `Parcels/`
  - `ParcelsManager.js`: Tracks and updates the status of parcels.
  - `Parcel.js`: Represents individual parcel objects.
- `Players/`
  - `PlayersManager.js`: Tracks and updates other players in the game.
  - `Player.js`: Represents a single player entity.

### Memory

- `Percepts.js`: Entry point for processing environmental input.
- `PDDL/`
  - `Domain.pddl`: Domain definition for PDDL-based planning.
- `Reasoning/`
  - `Beliefs.js`: Manages the agent’s internal state (used by PDDL strategy).
  - `Moves/`: Movement logic, shared by BFS and PDDL plans.
  - `Options.js`: Generates and filters possible actions (pickup, deliver, patrol).
  - `UtilityCalculator.js`: Computes utility scores for each option.
  - `Intentions.js`: Executes and manages agent’s intentions.
  - `Planning/`
    - `Planner.js`: Interfaces with the external PDDL solver.
    - `ProblemGenerator.js`: Generates PDDL planning problems.

### Utils

- `BfsExecutor.js`: Executes BFS plans and manages caching.
- `Position.js`: Represents coordinates on the map.
- `PriorityQueue.js`: Queue implementation for managing options by utility.

### Communication (Multi-agent mode)

- `Communication.js`: Manages events and synchronization between agents.
- `CommunicationWithBfs.js`: Specialization for BFS agents.
- `CommunicationWithPddl.js`: Specialization for PDDL agents.
- `TeamManager.js`: Manages shared team-level knowledge and state.

### API_classes_with_changes

- Modified API files to enable extended behaviors and better control over planning.

### test/performance_analysis/

- `Analysis.ipynb`: Jupyter notebook with performance plots and comparison metrics.
- `test_scores.xlsx`: Summary of test results from single and multi-agent experiments.


## Agent Architecture

The agent is built using modular JavaScript classes:

- **Agent**: Main class coordinating all components.
- **Percepts**: Handles perceptions from the environment.
- **Beliefs / Options / Intentions**: Implements BDI loop.
- **Planner**: Interfaces with external PDDL solver.
- **BfsExecutor**: Plans using Breadth-First Search with caching.
- **UtilityCalculator**: Scores options based on utility.
- **Communication (multi-agent)**: Handles teammate synchronization and cooperation.

Agent behaviors are managed asynchronously using an `EventEmitter`, enabling modular and reactive event handling.

## Strategies

### BFS Strategy
- Fast and reliable for real-time environments.
- Includes caching of paths and safety checks.
- Uses BFS-based movement plan generation.

### PDDL Strategy

- Employs domain-level planning using the [planning.domains API](https://solver.planning.domains).
- Caches and reuses plans.
- Manages belief updates in a classical planning setting.

## Multi-Agent Mode

Three cooperative strategies are available:

1. **Strategy 1**: Two BFS agents with communication and parcel sharing.
2. **Strategy 2**: Two PDDL agents, sharing plans and environment information.
3. **Strategy 3**: A master-slave PDDL configuration with shared multi-agent plan generation.

Multi-agent synchronization uses event-based signaling and includes:
- Parcel handoff procedures
- Conflict-free intention validation
- Master selection via event-driven protocol

## Testing

The agent has been tested in several environments:
- `challenge_21` to `challenge_24` for single agent
- `challenge_31` to `challenge_33` for multi-agent

Metrics:
- **Score**
- **Score per second**
- **Average move time (ms)**

See `test/performance_analysis/Analysis.ipynb` for a full analysis and charts.

