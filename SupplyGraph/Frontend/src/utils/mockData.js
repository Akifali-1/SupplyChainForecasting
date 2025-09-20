// Mock authentication system
export const mockAuth = {
    users: [
      { id: 1, email: 'demo@company.com', password: 'password123', companyName: 'Demo Corp' }
    ],
  
    login: async (email, password) => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const user = mockAuth.users.find(u => u.email === email && u.password === password);
      if (user) {
        return {
          success: true,
          user: { id: user.id, email: user.email, companyName: user.companyName }
        };
      } else {
        return { success: false, error: 'Invalid email or password' };
      }
    },
  
    register: async (companyName, email, password) => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const existingUser = mockAuth.users.find(u => u.email === email);
      if (existingUser) {
        return { success: false, error: 'Email already exists' };
      }
      
      const newUser = {
        id: mockAuth.users.length + 1,
        email,
        password,
        companyName
      };
      
      mockAuth.users.push(newUser);
      return {
        success: true,
        user: { id: newUser.id, email: newUser.email, companyName: newUser.companyName }
      };
    }
  };
  
  // Mock file upload system
  export const mockUpload = {
    uploadFiles: async (files) => {
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const uploadedFiles = files.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString()
      }));
      
      return {
        success: true,
        files: uploadedFiles,
        message: 'Files uploaded successfully'
      };
    },
  
    startFineTuning: async () => {
      // Simulate fine-tuning process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return {
        success: true,
        message: 'Fine-tuning completed successfully',
        modelId: 'model_' + Math.random().toString(36).substr(2, 9)
      };
    }
  };
  
  // Mock prediction system
  export const mockPrediction = {
    predictDemand: async (storeName, productName) => {
      // Simulate prediction delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate mock prediction data
      const baseValue = Math.floor(Math.random() * 1000) + 100;
      const confidence = (Math.random() * 30 + 70).toFixed(1); // 70-100% confidence
      
      return {
        success: true,
        prediction: {
          storeName,
          productName,
          predictedDemand: baseValue,
          confidence: `${confidence}%`,
          trend: Math.random() > 0.5 ? 'increasing' : 'stable',
          recommendations: [
            'Consider increasing stock levels by 15%',
            'Monitor seasonal patterns for better accuracy',
            'Review supplier lead times for optimization'
          ],
          historicalData: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            demand: Math.floor(Math.random() * 200) + baseValue - 100
          }))
        }
      };
    }
  };
  
  // Mock features data for homepage
  export const mockFeatures = [
    {
      title: 'AI-Powered Forecasting',
      description: 'Advanced machine learning algorithms analyze your supply chain data to predict demand with high accuracy.',
      icon: 'brain'
    },
    {
      title: 'Real-time Analytics',
      description: 'Get instant insights and predictions to make informed decisions about inventory and supply planning.',
      icon: 'trending-up'
    },
    {
      title: 'Multi-format Support',
      description: 'Upload single datasets or separate node, edge, and demand files for comprehensive analysis.',
      icon: 'file-text'
    },
    {
      title: 'Custom Fine-tuning',
      description: 'Train models specifically on your data for improved accuracy and business-specific insights.',
      icon: 'settings'
    }
  ];