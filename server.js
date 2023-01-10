const express = require("express");
const app = express();
const { MongoClient, ObjectId } = require("mongodb");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 3000;
const url = "mongodb://localhost:27017/wpr-quiz";
var db;

MongoClient.connect(url).then((client) => {
  db = client.db();
  app.listen(PORT, () => {
    console.log(`Server start at port ${PORT}`);
  });
});

const createAttempt = async (req, res) => {
  const pair = await getRandomQuestion(10);
  const attempt = Object.assign(pair, {
    completed: false,
    startedAt: new Date(),
  });
  await db.collection("attempts").insertOne(attempt);
  delete attempt.correctAnswers;
  res.status(201).json(attempt);
};

const getRandomQuestion = async (size) => {
  const correctAnswers = {};
  const questions = await db
    .collection("questions")
    .aggregate([
      {
        $sample: { size },
      },
    ])
    .toArray();
  questions.forEach((e) => {
    correctAnswers[e._id] = e.correctAnswer;
    delete e.correctAnswer;
  });
  return {
    questions,
    correctAnswers,
  };
};

const submitAttempt = async (req, res) => {
  const { _id } = req.params;
  const { answers } = req.body;
  let score = 0;
  let attemptId;
  try {
    attemptId = ObjectId(_id);
  } catch (e) {
    console.log("Invalid attempt id");
    return res.status(404).end();
  }
  const attempt = await db.collection("attempts").findOne({ _id: attemptId });
  if (!attempt) return res.status(404).end();
  if (attempt.completed) {
    return res.status(200).json(attempt);
  }
  Object.keys(answers).forEach((key) => {
    if (answers[key] === attempt.correctAnswers[key]) {
      score++;
    }
  });
  let scoreText;
  if (score < 5) {
    scoreText = "Practice more to improve it :D";
  } else if (score < 7) {
    scoreText = "Good, keep up!";
  } else if (score && score < 9) {
    scoreText = "Well done!";
  } else {
    scoreText = "Perfect!!";
  }
  await db.collection("attempts").updateOne(
    { _id: attemptId },
    {
      $set: {
        completed: true,
        score: score,
        scoreText: scoreText,
        userAnswers: answers,
      },
    },
    { upsert: true }
  );
  const returnResult = await db
    .collection("attempts")
    .findOne({ _id: attemptId });
  res.status(200).json(returnResult);
};

app.post("/attempts", createAttempt);

app.post("/attempts/:_id/submit", submitAttempt);
