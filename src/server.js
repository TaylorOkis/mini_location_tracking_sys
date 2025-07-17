import server from "./app.js";

const PORT = process.env.PORT || 5000;

const start = () => {
  try {
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.log(`An error occurred while starting server\n ${err}`);
  }
};

start();
