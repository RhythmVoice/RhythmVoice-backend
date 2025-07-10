const handleValidationError = (error, res) => {
  const formattedErrors = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message
  }))

  res.status(400).json({
    error: '驗證錯誤',
    details: formattedErrors
  })
}

const createValidationMiddleware = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body)
      next()
    } catch (error) {
      handleValidationError(error, res)
    }
  }
}

export { createValidationMiddleware };