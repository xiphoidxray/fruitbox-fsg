#pragma once

#include <array>
#include <cstddef>
#include <nlohmann/json.hpp> // Add this include at the top
#include <random>
#include <string>
#include <unordered_map>
#include <vector>

namespace fruitbox {

struct Cell {
  std::size_t num_;
};

// Represents a player with their collected scores
struct Player {
  std::vector<std::size_t> scores;
  std::vector<std::size_t> current_round_scores_;
};

constexpr std::size_t HEIGHT = 10;
constexpr std::size_t WIDTH = 17;
using grid_t = std::array<std::array<Cell, WIDTH>, HEIGHT>;

class GameState {
public:
  GameState();

  // Initializes the board for a new round with random fruit types
  [[nodiscard]] grid_t InitRound();

  // Adds or retrieves a player by name
  Player &GetOrAddPlayer(const std::string &player_name);

  // Whenever player scores, this will be called
  void UpdatePlayerScore(const std::string &player_name,
                         const std::size_t delta);
  [[nodiscard]] nlohmann::json SerializeCurrentRoundScores() const;

  std::unordered_map<std::string, Player> players_;
  std::size_t total_rounds_ = 0;
  std::size_t current_round_ = 0;

private:
  std::mt19937 rng_;
};
} // namespace fruitbox
