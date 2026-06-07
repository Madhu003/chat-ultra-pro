import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../atoms/Button';
import { Avatar, AvatarFallback, AvatarImage } from '../atoms/Avatar';
import { LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, signInWithGoogle, logout } = useAuth();

  return (
    <nav className="flex items-center justify-between px-6 py-3 bg-background border-b border-border shadow-sm z-10">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Chat Ultra Pro
        </span>
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.photoURL || ''} alt={user.displayName || ''} />
                <AvatarFallback>{user.displayName?.[0] || user.email?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:block text-foreground">
                {user.displayName || user.email}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        ) : (
          <Button onClick={signInWithGoogle} variant="default" size="sm">
            Sign In with Google
          </Button>
        )}
      </div>
    </nav>
  );
};
