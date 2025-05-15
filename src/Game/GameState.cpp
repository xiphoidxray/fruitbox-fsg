#include "GameState.h"
#include <random>

namespace fruitbox {

GameState::GameState() { rng_.seed(0); }

grid_t GameState::InitRound() {
  grid_t grid{};
  std::uniform_int_distribution<std::size_t> dist(1, 5); // 5 fruit types
  for (std::size_t i = 0; i < HEIGHT; ++i) {
    for (std::size_t j = 0; j < WIDTH; ++j) {
      grid[i][j].num_ = dist(rng_);
    }
  }
  current_round_++;
  for (auto &[_, player] : players_) {
    player.scores.push_back(0);
    player.current_round_scores_.clear();
  }
  return grid;
}

void GameState::UpdatePlayerScore(const std::string &player_name,
                                  const std::size_t delta) {
  players_[player_name].scores.back() += delta;
  players_[player_name].current_round_scores_.push_back(delta);
}

Player &GameState::GetOrAddPlayer(const std::string &player_name) {
  return players_[player_name];
}
} // namespace fruitbox
