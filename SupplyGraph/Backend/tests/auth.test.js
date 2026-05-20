const { requireAuth, requireRole } = require("../utils/auth");

describe("Authorization Middleware", () => {
  let mockReq;
  let mockRes;
  let nextFunction;

  beforeEach(() => {
    mockReq = {
      isAuthenticated: jest.fn(),
      user: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  describe("requireAuth", () => {
    it("should call next if user is authenticated", () => {
      mockReq.isAuthenticated.mockReturnValue(true);
      requireAuth(mockReq, mockRes, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    it("should return 401 if user is not authenticated", () => {
      mockReq.isAuthenticated.mockReturnValue(false);
      requireAuth(mockReq, mockRes, nextFunction);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Unauthorized" })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe("requireRole", () => {
    it("should return 401 if user is not authenticated", () => {
      mockReq.isAuthenticated.mockReturnValue(false);
      const middleware = requireRole(["admin"]);
      middleware(mockReq, mockRes, nextFunction);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should return 403 if user does not have permission", () => {
      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { role: "user" };
      const middleware = requireRole(["admin"]);
      middleware(mockReq, mockRes, nextFunction);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Forbidden" })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should call next if user has correct role", () => {
      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { role: "admin" };
      const middleware = requireRole(["admin"]);
      middleware(mockReq, mockRes, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    it("should support multiple roles", () => {
      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { role: "user" };
      const middleware = requireRole(["admin", "user"]);
      middleware(mockReq, mockRes, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
